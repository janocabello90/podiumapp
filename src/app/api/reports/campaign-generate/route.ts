import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { getReportInstructions } from '@/lib/reports/prompt'
import { redactManyNames, restoreManyNames } from '@/lib/reports/redact'
import { DESCARGO_CAMPAIGN } from '@/lib/reports/descargo'
import { REPORT_MODEL } from '@/lib/reports/aiConfig'
import { callReportModel, describeModelError } from '@/lib/reports/callReportModel'
import { parseMetricsSchema, computeTeamMetrics, TEAM_THRESHOLDS, type PlayerMetrics, type TeamMetricStat } from '@/lib/reports/metrics'
import { buildTeamDashboard, buildDashboardSynthesis } from '@/lib/reports/teamDashboard'
import { runReportInBackground, activeSince } from '@/lib/reports/background'

// Generación en SEGUNDO PLANO (waitUntil tras responder).
export const maxDuration = 800

// Informe de EQUIPO por RONDA (agregado). Cuantitativo CALCULADO en código (la IA no inventa
// cifras) + síntesis CUALITATIVA por IA a partir de los informes individuales APROBADOS del equipo.
const MAX_PLAYERS = 40

const STRUCTURE_TEAM_ROUND = `Eres fisioterapeuta especialista en readaptación y rendimiento deportivo. Redactas el INFORME DE EQUIPO (rendimiento y prevención) de una ronda de valoración, dirigido al CUERPO TÉCNICO del club. Tu misión: convertir los datos ya procesados en una LECTURA DE CONJUNTO útil para tomar decisiones de entrenamiento y prevención.

Se te entrega: (a) una SÍNTESIS YA CALCULADA (KPIs, jugadores por nivel de riesgo con su motivo, patrón de lesiones, medias del panel) y (b) las CONCLUSIONES de los informes individuales ya APROBADOS por el fisio de cada jugador. NO recibes datos crudos: las cifras ya están calculadas y son la fuente de verdad.

Devuelve SOLO un JSON válido con EXACTAMENTE estas claves (todo CUALITATIVO):
{
  "resumen_equipo": "2-3 párrafos. Cómo llega el equipo en esta ronda: estado general, temas transversales y lectura global del colectivo. Integra las cifras clave dentro de la prosa (no las listes).",
  "patrones_y_riesgos": "Patrones colectivos y riesgos (de carga, lesional, por capacidad o por región corporal). Redacta SIEMPRE en hipótesis prudente ('sugiere', 'compatible con', 'podría'): no es un diagnóstico médico.",
  "fortalezas": "Puntos fuertes reales del colectivo detectados en las valoraciones.",
  "grupos_de_trabajo": [{ "nombre": "Nombre corto del grupo (p. ej. 'Control lumbopélvico', 'Fuerza excéntrica de isquios')", "foco": "Objetivo de trabajo del grupo en una frase", "jugadores": ["[[JUGADOR_n]]"] }],
  "jugadores_a_vigilar": [{ "nombre": "[[JUGADOR_n]]", "motivo": "Motivo concreto y breve" }],
  "recomendaciones": "Recomendaciones colectivas PRIORIZADAS y accionables para el cuerpo técnico (prevención, trabajo por grupos, seguimiento). En prosa, de mayor a menor prioridad."
}

REGLAS ESTRICTAS:
- Español clínico, profesional y claro. Párrafos narrativos; nada de listas con guiones fuera de los arrays indicados.
- NO inventes ni recalcules cifras: usa EXCLUSIVAMENTE las de la síntesis. El informe AGREGA las valoraciones individuales, no las sustituye ni diagnostica.
- Propón entre 2 y 4 grupos de trabajo coherentes con los hallazgos; un jugador puede estar en varios grupos; usa solo jugadores del contexto.
- PRIVACIDAD: nombra a los jugadores EXCLUSIVAMENTE con las etiquetas «[[JUGADOR_n]]» que aparecen en el contexto; nunca inventes ni deduzcas nombres reales.
- Responde SOLO con el JSON válido, sin texto adicional ni explicaciones.`

export async function POST(request: NextRequest) {
  const requestStart = Date.now() // para registrar cuánto tarda en generarse el informe
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key de Anthropic no configurada' }, { status: 500 })

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const body = await request.json()
    const campaignId = body.campaignId as string
    const teamId = body.teamId as string
    const round = Number(body.round)
    const excludedSet = new Set<string>(Array.isArray(body.excluded) ? body.excluded : [])
    if (!campaignId || !teamId || !Number.isFinite(round)) {
      return NextResponse.json({ error: 'campaignId, teamId y round son obligatorios' }, { status: 400 })
    }

    // Estudio (scope de clínica) + grupo.
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, group_id, groups(name)')
      .eq('id', campaignId)
      .eq('clinic_id', profile.clinic_id)
      .single()
    if (!campaign) return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })

    // El equipo debe pertenecer al estudio.
    const { data: ct } = await supabase
      .from('campaign_teams')
      .select('team_id, teams(name)')
      .eq('campaign_id', campaignId)
      .eq('team_id', teamId)
      .eq('clinic_id', profile.clinic_id)
      .maybeSingle()
    if (!ct) return NextResponse.json({ error: 'El equipo no pertenece a este estudio' }, { status: 400 })
    const teamName = (ct.teams as any)?.name || 'Equipo'

    // Gate: la ronda debe estar CERRADA para poder generar el informe de equipo.
    const { data: roundRow } = await supabase
      .from('campaign_team_rounds')
      .select('status')
      .eq('campaign_id', campaignId).eq('team_id', teamId).eq('round_number', round)
      .eq('clinic_id', profile.clinic_id).maybeSingle()
    if (!roundRow || (roundRow as any).status !== 'closed') {
      return NextResponse.json({ error: 'Cierra la ronda antes de generar el informe de equipo.' }, { status: 409 })
    }

    // Roster del equipo.
    const { data: roster } = await supabase
      .from('patients')
      .select('id, full_name')
      .eq('team_id', teamId)
      .eq('clinic_id', profile.clinic_id)
      .eq('status', 'active')
      .order('full_name')
    const rosterList = roster || []
    if (rosterList.length === 0) return NextResponse.json({ error: 'El equipo no tiene jugadores' }, { status: 400 })

    // Sesiones de ESTA ronda del estudio para estos jugadores.
    const patientIds = rosterList.map((p) => p.id)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, patient_id')
      .eq('campaign_id', campaignId)
      .eq('campaign_round', round)
      .in('patient_id', patientIds)
      .eq('clinic_id', profile.clinic_id)
    const sessionByPatient = new Map<string, string>()
    for (const s of sessions || []) if (!sessionByPatient.has(s.patient_id)) sessionByPatient.set(s.patient_id, s.id)

    // Incluidos = roster - excluidos.
    const included = rosterList.filter((p) => !excludedSet.has(p.id))
    if (included.length === 0) return NextResponse.json({ error: 'No hay jugadores incluidos' }, { status: 400 })

    // Informes individuales APROBADOS de la ronda para los incluidos.
    const includedSessionIds = included.map((p) => sessionByPatient.get(p.id)).filter(Boolean) as string[]
    const { data: approved } = includedSessionIds.length
      ? await supabase
          .from('reports')
          .select('id, session_id, report_data')
          .eq('scope', 'individual')
          .eq('status', 'approved')
          .in('session_id', includedSessionIds)
      : { data: [] as any[] }
    const reportBySession = new Map<string, any>()
    for (const r of approved || []) if (!reportBySession.has(r.session_id)) reportBySession.set(r.session_id, r)

    // Gating: cada incluido debe tener sesión de la ronda + informe individual aprobado.
    const missing = included.filter((p) => {
      const sid = sessionByPatient.get(p.id)
      return !sid || !reportBySession.has(sid)
    })
    if (missing.length > 0) {
      return NextResponse.json({
        error: `No se puede generar: falta el informe individual aprobado de ${missing.length} jugador(es): ${missing.map((p) => p.full_name).join(', ')}. Apruébalos o exclúyelos.`,
      }, { status: 400 })
    }

    // Candado de concurrencia: no duplicar el informe de este (equipo, ronda) si ya hay uno en curso.
    {
      const { data: inFlight } = await supabase
        .from('reports').select('id')
        .eq('campaign_id', campaign.id).eq('team_id', teamId).eq('campaign_round', round)
        .eq('status', 'generating').gte('created_at', activeSince()).limit(1).maybeSingle()
      if (inFlight) return NextResponse.json({ error: 'Ya se está generando el informe de este equipo/ronda' }, { status: 409 })
    }

    // Fila en 'generating' (coherente: campaign ⇒ campaign_id + team_id + campaign_round). 202 + trabajo detrás.
    const { data: pending, error: pendingErr } = await supabase
      .from('reports')
      .insert({
        clinic_id: profile.clinic_id, scope: 'campaign',
        campaign_id: campaign.id, team_id: teamId, campaign_round: round, patient_id: null,
        generated_by: user.id, status: 'generating',
      })
      .select('id').single()
    if (pendingErr || !pending) {
      return NextResponse.json({ error: 'No se pudo iniciar la generación' }, { status: 500 })
    }
    const reportId = pending.id

    runReportInBackground(reportId, async () => {
    const cappedIncluded = included.slice(0, MAX_PLAYERS)

    // Métricas por jugador (para el cálculo cuantitativo).
    const { data: sts } = await supabase
      .from('session_tests')
      .select('session_id, test_name, result_data, display_order, tests(result_schema)')
      .in('session_id', includedSessionIds)
      .order('display_order', { ascending: true })
    const testsBySession = new Map<string, any[]>()
    for (const st of sts || []) {
      const arr = testsBySession.get(st.session_id) || []
      arr.push(st)
      testsBySession.set(st.session_id, arr)
    }

    // Privacidad: cada jugador → etiqueta.
    const nameEntries = cappedIncluded.map((p, i) => ({ name: p.full_name || `Jugador ${i + 1}`, token: `[[JUGADOR_${i + 1}]]` }))
    const tokenByPatient = new Map(cappedIncluded.map((p, i) => [p.id, `[[JUGADOR_${i + 1}]]`]))
    const tokenByName = new Map(nameEntries.map((e) => [e.name, e.token]))

    const players: PlayerMetrics[] = cappedIncluded.map((p) => {
      const sid = sessionByPatient.get(p.id)!
      const arr = testsBySession.get(sid) || []
      return {
        nombre: p.full_name,
        tests: arr
          .map((st: any) => ({ test_name: st.test_name, metrics: parseMetricsSchema(st.tests?.result_schema), values: st.result_data || {} }))
          .filter((t: any) => t.metrics.length > 0),
      }
    })
    const panel: TeamMetricStat[] = computeTeamMetrics(players)

    // ===== CÁLCULO (determinista) — cuadro de mando: KPIs, semáforo, lesiones, anexo =====
    // Lesiones por jugador desde su anamnesis (celdas libres → normalizadas en el helper).
    const { data: anamRows } = await supabase
      .from('anamnesis_forms')
      .select('patient_id, form_data, created_at')
      .in('patient_id', cappedIncluded.map((p) => p.id))
      .order('created_at', { ascending: false })
    const injByPatient = new Map<string, any[]>()
    for (const a of anamRows || []) {
      if (injByPatient.has((a as any).patient_id)) continue
      const inj = Array.isArray((a as any).form_data?.injuries_24m) ? (a as any).form_data.injuries_24m : []
      injByPatient.set((a as any).patient_id, inj)
    }
    const injuriesByName = new Map<string, any[]>()
    for (const p of cappedIncluded) injuriesByName.set(p.full_name, injByPatient.get(p.id) || [])

    const dashboard = buildTeamDashboard(players, panel, injuriesByName)
    const synthesis = buildDashboardSynthesis(dashboard)

    // Titular (1 frase) de cada informe individual aprobado → para el anexo.
    const titularByName = new Map<string, string>()
    for (const p of cappedIncluded) {
      const rd = reportBySession.get(sessionByPatient.get(p.id)!)?.report_data || {}
      const c = String(rd.conclusiones || rd.hallazgos || '').trim()
      if (c) {
        let t = (c.split(/(?<=\.)\s/)[0] || c).trim() // primera frase
        if (t.length > 200) t = t.slice(0, 200).replace(/\s+\S*$/, '') + '…' // recorte en palabra, no a medias
        titularByName.set(p.full_name, t)
      }
    }
    const anexo = dashboard.anexo.map((r) => ({ ...r, titular: titularByName.get(r.nombre) || null }))

    // ===== Contexto para la IA (tokenizado; SOLO síntesis + conclusiones, nada de datos crudos) =====
    const groupName = (campaign.groups as any)?.name as string | undefined
    let context = `EQUIPO: ${teamName}\nESTUDIO: ${campaign.name}\n`
    if (groupName) context += `GRUPO: ${groupName}\n`
    context += `RONDA: ${round}\nCOBERTURA: ${cappedIncluded.length} de ${rosterList.length} jugadores (excluidos: ${rosterList.length - included.length})\n`
    context += `\n===== SÍNTESIS YA CALCULADA (NO inventes ni recalcules cifras) =====\n${synthesis}\n`
    if (panel.length > 0) {
      const lines = panel.map((s) => {
        const stat = s.bilateral
          ? `media izq ${s.mean_izq ?? '—'}, der ${s.mean_der ?? '—'}`
          : `media ${s.mean ?? '—'}${s.min != null ? ` (rango ${s.min}–${s.max})` : ''}`
        return `- ${s.test_name} · ${s.label}${s.unit ? ` (${s.unit})` : ''}: ${stat}, n=${s.n}`
      })
      context += `\n===== PANEL DE MÉTRICAS (calculado) =====\n${lines.join('\n')}\n`
    }
    context += `\n===== CONCLUSIONES POR JUGADOR (de su informe individual aprobado) =====\n`
    for (const p of cappedIncluded) {
      const rd = reportBySession.get(sessionByPatient.get(p.id)!)?.report_data || {}
      const concl = String(rd.conclusiones || rd.hallazgos || '').trim()
      context += `--- ${tokenByPatient.get(p.id)} ---\n${concl ? concl.slice(0, 900) : '(sin conclusiones)'}\n\n`
    }
    if (included.length > MAX_PLAYERS) {
      context += `\n(Nota: incluidos los primeros ${MAX_PLAYERS} de ${included.length} jugadores por límite.)\n`
    }
    // Privacidad: eliminar cualquier nombre real que aún aparezca (síntesis + conclusiones).
    context = redactManyNames(context, nameEntries)

    const reportInstructions = await getReportInstructions(supabase, profile.clinic_id, 'campaign')
    const systemPrompt = `${reportInstructions}\n\n${STRUCTURE_TEAM_ROUND}`

    const anthropic = new Anthropic({ apiKey })
    // Generar + parsear con robustez (parser tolerante + reparación + reintento automático).
    let ai: any
    let usage: any = null
    try {
      const r = await callReportModel(anthropic, {
        system: systemPrompt,
        messages: [{ role: 'user', content: `Genera el informe de equipo de la ronda. Responde SOLO con JSON válido.\n\nPRIVACIDAD: NO se facilitan nombres reales; cada jugador está identificado por «[[JUGADOR_n]]»; úsala TAL CUAL.\n\n${context}` }],
      })
      ai = r.reportData
      usage = r.usage
    } catch (e: any) {
      if (!e?.isParseFailure) {
        // Error de API (sin créditos, sobrecarga, red): guardar la causa REAL, no "parseo".
        const desc = describeModelError(e)
        console.error('Campaign model API error:', desc.message)
        await supabase.from('reports').update({
          status: 'error',
          report_data: { _error: desc.message, _api_error: true, _credit_error: desc.isCredit },
        }).eq('id', reportId)
        return
      }
      const stopReason = e?.stopReason ?? null
      console.error('Failed to parse campaign response (tras reintento). stop_reason=', stopReason)
      await supabase.from('reports').update({
        status: 'error',
        report_data: {
          _error: stopReason === 'max_tokens'
            ? 'La respuesta de la IA se cortó por longitud (max_tokens). Reinténtalo.'
            : 'No se pudo parsear el JSON de la respuesta de la IA (tras un reintento).',
          _stop_reason: stopReason ?? null,
          _raw_response: (e?.raw || '').slice(0, 24000),
        },
      }).eq('id', reportId)
      return
    }
    ai = restoreManyNames(ai, nameEntries)

    const excludedNames = rosterList.filter((p) => excludedSet.has(p.id)).map((p) => p.full_name)
    const reportData = {
      _template: 'team_round',
      portada: {
        equipo: teamName,
        estudio: campaign.name,
        grupo: groupName || null,
        ronda: round,
        cobertura: `${cappedIncluded.length}/${rosterList.length}`,
      },
      // ---- Calculado en código (determinista; NO pasa por la IA) ----
      kpis: dashboard.kpis,
      semaforo: dashboard.riesgos,
      panel_metricas: panel,
      lesiones: dashboard.lesiones,
      anexo,
      // ---- Redactado por la IA ----
      resumen_equipo: ai.resumen_equipo || '',
      patrones_y_riesgos: ai.patrones_y_riesgos || '',
      fortalezas: ai.fortalezas || '',
      grupos_de_trabajo: Array.isArray(ai.grupos_de_trabajo) ? ai.grupos_de_trabajo : [],
      jugadores_a_vigilar: Array.isArray(ai.jugadores_a_vigilar) ? ai.jugadores_a_vigilar : [],
      recomendaciones: ai.recomendaciones || '',
      descargo: DESCARGO_CAMPAIGN,
      // ---- Vista (preset por defecto; el editor la cambia sin regenerar) ----
      _view: { preset: 'cuadro_mando' },
      _meta: {
        equipo: teamName,
        estudio: campaign.name,
        grupo: groupName || null,
        ronda: round,
        incluidos: cappedIncluded.map((p) => p.full_name),
        excluidos: excludedNames,
        cobertura_valorados: cappedIncluded.length,
        roster_total: rosterList.length,
        umbrales: TEAM_THRESHOLDS,
        datos_vald: 'extraidos_ia_sin_validar',
      },
    }

    // Registro del tiempo de generación (de inicio de petición a informe listo).
    ;(reportData as any)._generation_ms = Date.now() - requestStart

    const { error: reportError } = await supabase
      .from('reports')
      .update({
        status: 'draft',
        report_data: reportData,
        ai_model: REPORT_MODEL,
        ai_prompt_tokens: usage?.input_tokens || null,
        ai_completion_tokens: usage?.output_tokens || null,
      })
      .eq('id', reportId)

    if (reportError) {
      console.error('Team-round report save error:', reportError)
      throw new Error('Error al guardar el informe de equipo')
    }
    })

    return NextResponse.json({ reportId, status: 'generating' }, { status: 202 })
  } catch (error: any) {
    console.error('Team-round report generation error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
