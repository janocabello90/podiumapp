import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { getReportInstructions } from '@/lib/reports/prompt'
import { redactManyNames, restoreManyNames } from '@/lib/reports/redact'
import { DESCARGO_CAMPAIGN } from '@/lib/reports/descargo'
import { REPORT_MODEL, REPORT_MAX_TOKENS, REPORT_THINKING, REPORT_EFFORT } from '@/lib/reports/aiConfig'
import { parseMetricsSchema, computeTeamMetrics, TEAM_THRESHOLDS, type PlayerMetrics, type TeamMetricStat } from '@/lib/reports/metrics'
import { runReportInBackground, activeSince } from '@/lib/reports/background'

// Generación en SEGUNDO PLANO (waitUntil tras responder).
export const maxDuration = 800

// Informe de EQUIPO por RONDA (agregado). Cuantitativo CALCULADO en código (la IA no inventa
// cifras) + síntesis CUALITATIVA por IA a partir de los informes individuales APROBADOS del equipo.
const MAX_PLAYERS = 40

const STRUCTURE_TEAM_ROUND = `Se te da una SÍNTESIS DE MÉTRICAS ya calculada (medias, rangos, jugadores a vigilar) y los TITULARES de los informes individuales aprobados de cada jugador. Con eso redacta una lectura de conjunto del EQUIPO en esta ronda.

Genera SOLO un JSON válido con estas claves (todo CUALITATIVO; las CIFRAS ya están calculadas, NO inventes ni recalcules medias ni porcentajes):
{
  "resumen_equipo": "2-3 párrafos: cómo llega el equipo en esta ronda, temas transversales, impresión global del colectivo.",
  "patrones_y_riesgos": "Patrones transversales y posibles riesgos (de carga, lesionales, por capacidad/región). Siempre en hipótesis: 'posible', 'sugiere', 'compatible con'.",
  "fortalezas": "Puntos fuertes del colectivo detectados en las valoraciones.",
  "jugadores_a_vigilar": [{ "nombre": "[[JUGADOR_n]]", "motivo": "..." }],
  "recomendaciones": "Recomendaciones colectivas priorizadas para el cuerpo técnico (prevención, trabajo por grupos, seguimiento)."
}

REGLAS:
- Español clínico profesional, párrafos narrativos.
- NO inventes cifras: usa las de la SÍNTESIS DE MÉTRICAS. No es diagnóstico médico; el informe agrega valoraciones individuales y no las sustituye.
- Para nombrar jugadores usa EXACTAMENTE las etiquetas «[[JUGADOR_n]]» que aparecen en el contexto; no inventes nombres.
- Responde SOLO con el JSON válido, sin texto adicional.`

export async function POST(request: NextRequest) {
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

    // ===== Contexto para la IA (tokenizado) =====
    const groupName = (campaign.groups as any)?.name as string | undefined
    let context = `EQUIPO: ${teamName}\nESTUDIO: ${campaign.name}\n`
    if (groupName) context += `GRUPO: ${groupName}\n`
    context += `RONDA: ${round}\nCOBERTURA: ${cappedIncluded.length} de ${rosterList.length} jugadores (excluidos: ${rosterList.length - included.length})\n`

    if (panel.length > 0) {
      const lines = panel.map((s) => {
        const stat = s.bilateral
          ? `media izq ${s.mean_izq ?? '—'}, der ${s.mean_der ?? '—'}`
          : `media ${s.mean ?? '—'}${s.min != null ? ` (rango ${s.min}–${s.max})` : ''}`
        const vig = s.outliers.length
          ? ` · a vigilar: ${s.outliers.map((o) => `${tokenByName.get(o.nombre) || '[jugador]'} (${o.detalle})`).join(', ')}`
          : ''
        return `- ${s.test_name} · ${s.label}${s.unit ? ` (${s.unit})` : ''}: ${stat}, n=${s.n}${vig}`
      })
      context += `\n===== SÍNTESIS DE MÉTRICAS DEL EQUIPO (ya calculada; NO inventes cifras) =====\n${lines.join('\n')}\n`
    }

    // Titulares de cada informe individual aprobado.
    context += `\n===== TITULARES POR JUGADOR (de sus informes individuales aprobados) =====\n`
    for (const p of cappedIncluded) {
      const rd = reportBySession.get(sessionByPatient.get(p.id)!)?.report_data || {}
      const re = rd.resumen_ejecutivo || {} // compat. informes antiguos (ya no se genera)
      context += `--- ${tokenByPatient.get(p.id)} ---\n`
      if (rd.hallazgos) context += `Hallazgos: ${rd.hallazgos}\n`
      // Los informes nuevos integran fortalezas/riesgo/objetivo en "conclusiones".
      if (rd.conclusiones) context += `Conclusiones: ${rd.conclusiones}\n`
      else {
        if (re.aspectos_mejorar) context += `A mejorar: ${re.aspectos_mejorar}\n`
        if (re.riesgo_funcional) context += `Riesgo funcional: ${re.riesgo_funcional}\n`
      }
      context += `\n`
    }

    if (included.length > MAX_PLAYERS) {
      context += `\n(Nota: se han incluido los primeros ${MAX_PLAYERS} de ${included.length} jugadores por límite de longitud.)\n`
    }

    // Privacidad: eliminar cualquier nombre real que aún aparezca en los titulares.
    context = redactManyNames(context, nameEntries)

    const reportInstructions = await getReportInstructions(supabase, profile.clinic_id, 'campaign')
    const systemPrompt = `${reportInstructions}\n\n${STRUCTURE_TEAM_ROUND}`

    const anthropic = new Anthropic({ apiKey })
    const stream = anthropic.messages.stream({
      model: REPORT_MODEL,
      max_tokens: REPORT_MAX_TOKENS,
      thinking: REPORT_THINKING,
      output_config: REPORT_EFFORT,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Genera el informe de equipo de la ronda. Responde SOLO con JSON válido.\n\nPRIVACIDAD: NO se facilitan nombres reales; cada jugador está identificado por «[[JUGADOR_n]]»; úsala TAL CUAL.\n\n${context}` }],
    } as any)
    const message = await stream.finalMessage()

    const responseText = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    let ai: any
    try {
      const m = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      ai = JSON.parse((m ? m[1] : responseText).trim())
    } catch {
      console.error('Failed to parse campaign response:', responseText.substring(0, 500))
      throw new Error('Error al procesar la respuesta de IA')
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
      resumen_equipo: ai.resumen_equipo || '',
      panel_metricas: panel, // CALCULADO en código
      patrones_y_riesgos: ai.patrones_y_riesgos || '',
      fortalezas: ai.fortalezas || '',
      jugadores_a_vigilar: Array.isArray(ai.jugadores_a_vigilar) ? ai.jugadores_a_vigilar : [],
      recomendaciones: ai.recomendaciones || '',
      descargo: DESCARGO_CAMPAIGN,
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
      },
    }

    const { error: reportError } = await supabase
      .from('reports')
      .update({
        status: 'draft',
        report_data: reportData,
        ai_model: REPORT_MODEL,
        ai_prompt_tokens: message.usage?.input_tokens || null,
        ai_completion_tokens: message.usage?.output_tokens || null,
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
