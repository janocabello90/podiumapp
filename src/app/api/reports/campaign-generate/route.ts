import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Cap de jugadores incluidos en el prompt v1 (evita desbordar tokens en estudios grandes).
const MAX_PLAYERS_IN_PROMPT = 40

const SYSTEM_PROMPT = `Eres un fisioterapeuta clínico experto de Clínica PODIUM redactando un INFORME AGREGADO DE CAMPAÑA: una valoración de conjunto de uno o varios equipos de un grupo deportivo, a partir de las valoraciones individuales de sus jugadores. Escribes en español clínico profesional, riguroso y útil para el cuerpo técnico y médico.

IMPORTANTE — naturaleza cualitativa: dispones de NOTAS y de la interpretación del fisioterapeuta por jugador y por prueba, NO de datos numéricos estructurados. Por tanto el informe es CUALITATIVO: describe patrones, tendencias y hallazgos agrupados en lenguaje clínico, SIN inventar cifras, medias ni porcentajes que no estén en los datos.

ESTRUCTURA DEL INFORME (responde SOLO con un JSON válido con estas claves):

1. "portada_intro": Texto introductorio. Menciona el grupo/estudio, los equipos incluidos, la ventana temporal si se aporta, el número de jugadores valorados sobre el total (cobertura), y la metodología PODIUM aplicada a un colectivo (entender qué limita la capacidad del conjunto, no solo listar lesiones). Deja claro que el informe agrega valoraciones individuales y no las sustituye.

2. "resumen_campana": 2-3 párrafos con el estado general del colectivo: cómo llega el grupo, temas transversales, impresión global.

3. "hallazgos_por_equipo": Array de objetos { "equipo": string, "resumen": string, "hallazgos": string[] }. Un objeto por cada equipo incluido en el estudio, con un resumen y una lista de hallazgos relevantes de ese equipo. Si un equipo no tiene jugadores valorados, indícalo brevemente.

4. "patrones_y_riesgos": Párrafos que identifiquen patrones transversales y posibles riesgos (de carga, lesionales, regionales) del colectivo. SIEMPRE en lenguaje de hipótesis: "posible", "compatible con", "sugiere". Nunca diagnóstico definitivo.

5. "fortalezas": Puntos fuertes del colectivo detectados en las valoraciones.

6. "jugadores_a_vigilar": Array de objetos { "nombre": string, "equipo": string, "motivo": string } con los jugadores que requieren atención o seguimiento individual prioritario. Remite a su informe individual; no lo reemplaces.

7. "recomendaciones": Recomendaciones colectivas priorizadas (prevención, trabajo por grupos, seguimiento), adaptadas al Método Podium™.

8. "descargo": Descargo estándar adaptado a informe colectivo: "El presente informe de estudio ha sido elaborado conforme al Método Podium™, agregando las valoraciones individuales de los jugadores incluidos. Su redacción ha sido asistida por un sistema de inteligencia artificial (Anthropic Claude, vía API) como herramienta de soporte, y ha sido íntegramente revisado, editado y aprobado por un fisioterapeuta colegiado antes de su emisión. El proveedor de IA no almacena ni reutiliza los datos. Este documento no constituye un diagnóstico médico, no sustituye la valoración individual de cada jugador ni la valoración de un facultativo médico, y no debe interpretarse como informe pericial ni prueba en procedimientos judiciales, administrativos, aseguradores o legales. Su finalidad es orientar el trabajo colectivo y el seguimiento del grupo en el ámbito asistencial para el que ha sido diseñado."

REGLAS:
- Español clínico profesional, párrafos narrativos.
- NO inventes datos, cifras ni jugadores que no aparezcan en la información aportada.
- Hipótesis siempre con "posible", "compatible con" o "sugiere".
- Responde SOLO con el JSON válido, sin texto adicional.`

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key de Anthropic no configurada' }, { status: 500 })
    }

    const supabase = createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { campaignId } = await request.json()
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId requerido' }, { status: 400 })
    }

    // Estudio (scope de clínica).
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, start_date, end_date_planned, group_id, groups(name)')
      .eq('id', campaignId)
      .eq('clinic_id', profile.clinic_id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Estudio no encontrada' }, { status: 404 })
    }

    // Equipos del estudio.
    const { data: cts } = await supabase
      .from('campaign_teams')
      .select('team_id, teams(id, name)')
      .eq('campaign_id', campaign.id)
      .eq('clinic_id', profile.clinic_id)
    const teams = (cts || []).map((ct: any) => ({ id: ct.team_id, name: ct.teams?.name ?? 'Equipo' }))
    const teamIds = teams.map((t) => t.id)
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]))

    if (teamIds.length === 0) {
      return NextResponse.json({ error: 'La estudio no tiene equipos' }, { status: 400 })
    }

    // Jugadores del roster + sesiones del estudio.
    const [{ data: players }, { data: sessions }] = await Promise.all([
      supabase
        .from('patients')
        .select('id, full_name, team_id, vald_interpretation')
        .in('team_id', teamIds)
        .eq('status', 'active'),
      supabase
        .from('sessions')
        .select('id, patient_id, notes, clinical_data')
        .eq('campaign_id', campaign.id)
        .eq('clinic_id', profile.clinic_id),
    ])

    const roster = players || []
    const sessionList = sessions || []
    const sessionIds = sessionList.map((s: any) => s.id)

    // Pruebas de esas sesiones (notas + guía de interpretación por prueba).
    const testsBySession = new Map<string, any[]>()
    if (sessionIds.length > 0) {
      const { data: sts } = await supabase
        .from('session_tests')
        .select('session_id, test_name, notes, status, display_order, tests(vald_interpretation_prompt)')
        .in('session_id', sessionIds)
        .order('display_order', { ascending: true })
      for (const st of sts || []) {
        const arr = testsBySession.get(st.session_id) || []
        arr.push(st)
        testsBySession.set(st.session_id, arr)
      }
    }

    // Sesión por jugador (la primera encontrada; v1 no distingue seguimientos).
    const sessionByPatient = new Map<string, any>()
    for (const s of sessionList) {
      if (!sessionByPatient.has(s.patient_id)) sessionByPatient.set(s.patient_id, s)
    }

    const valuedPlayers = roster.filter((p: any) => sessionByPatient.has(p.id))
    if (valuedPlayers.length === 0) {
      return NextResponse.json({ error: 'Ningún jugador del estudio tiene valoración todavía' }, { status: 400 })
    }

    // Construcción de contexto agregado y acotado (resumen cualitativo por jugador).
    const groupName = (campaign.groups as any)?.name as string | undefined
    const coverage = `${valuedPlayers.length} de ${roster.length}`

    let context = `CAMPAÑA: ${campaign.name}\n`
    if (groupName) context += `GRUPO: ${groupName}\n`
    context += `EQUIPOS INCLUIDOS: ${teams.map((t) => t.name).join(', ')}\n`
    if (campaign.start_date) context += `INICIO: ${campaign.start_date}\n`
    if (campaign.end_date_planned) context += `FIN PREVISTO: ${campaign.end_date_planned}\n`
    context += `COBERTURA (jugadores valorados / total del roster): ${coverage}\n`

    const cappedPlayers = valuedPlayers.slice(0, MAX_PLAYERS_IN_PROMPT)
    for (const p of cappedPlayers) {
      const s = sessionByPatient.get(p.id)
      const teamName = teamNameById.get(p.team_id) || 'Sin equipo'
      context += `\n--- JUGADOR: ${p.full_name} (equipo: ${teamName}) ---\n`

      if (s?.notes && String(s.notes).trim()) {
        context += `Notas de la valoración: ${s.notes}\n`
      }

      const sts = testsBySession.get(s.id) || []
      for (const t of sts) {
        const bits: string[] = []
        if (t.notes && String(t.notes).trim()) bits.push(`notas: ${t.notes}`)
        const prompt = t.tests?.vald_interpretation_prompt
        if (prompt && String(prompt).trim()) bits.push(`guía: ${prompt}`)
        if (bits.length > 0) context += `Prueba "${t.test_name}": ${bits.join(' | ')}\n`
      }

      if (p.vald_interpretation && String(p.vald_interpretation).trim()) {
        context += `Interpretación VALD del fisio: ${p.vald_interpretation}\n`
      }
    }

    if (valuedPlayers.length > MAX_PLAYERS_IN_PROMPT) {
      context += `\n(Nota: se han incluido los primeros ${MAX_PLAYERS_IN_PROMPT} jugadores valorados de ${valuedPlayers.length} por límite de longitud.)\n`
    }

    // Llamada a Claude.
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Genera el informe agregado de estudio PODIUM. Responde SOLO con JSON válido.\n\n${context}`,
        },
      ],
    })

    const responseText = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')

    let reportData
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText
      reportData = JSON.parse(jsonStr.trim())
    } catch {
      console.error('Failed to parse Claude campaign response:', responseText.substring(0, 500))
      return NextResponse.json({ error: 'Error al procesar la respuesta de IA' }, { status: 500 })
    }

    // Metadatos de cobertura para la UI/PDF.
    reportData._meta = {
      campaign_name: campaign.name,
      group_name: groupName || null,
      teams: teams.map((t) => t.name),
      valued: valuedPlayers.length,
      roster_total: roster.length,
    }

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        clinic_id: profile.clinic_id,
        scope: 'campaign',
        campaign_id: campaign.id,
        patient_id: null,
        generated_by: user.id,
        status: 'draft',
        report_data: reportData,
        ai_model: 'claude-sonnet-4-20250514',
        ai_prompt_tokens: message.usage?.input_tokens || null,
        ai_completion_tokens: message.usage?.output_tokens || null,
      })
      .select()
      .single()

    if (reportError) {
      console.error('Campaign report save error:', reportError)
      return NextResponse.json({ error: 'Error al guardar el informe de estudio' }, { status: 500 })
    }

    return NextResponse.json({ report })
  } catch (error: any) {
    console.error('Campaign report generation error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
