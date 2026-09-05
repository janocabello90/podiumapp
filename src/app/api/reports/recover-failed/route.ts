import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseReportJson } from '@/lib/reports/parseReportJson'
import { restorePatientName } from '@/lib/reports/redact'
import { buildTeamPerfil } from '@/lib/reports/teamPerfil'
import { DESCARGO_TEAM, DESCARGO_INDIVIDUAL } from '@/lib/reports/descargo'

// Recupera informes individuales SIN volver a llamar a la IA (coste 0):
//  - En 'error' con respuesta guardada (report_data._raw_response) → se reintenta el
//    parseo con el parser que repara (jsonrepair) y se guarda como 'draft'.
//  - Borradores de EQUIPO sin envolver (recuperados antes sin `_template`, que se ven
//    "raros" con el layout individual) → se re-envuelven con _template + perfil + descargo.
// Aplica el MISMO acabado que la generación (perfil del deportista, descargo), para que
// el informe se renderice igual que uno generado de cero.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const campaignId: string | undefined = body?.campaignId

    // Con campaña: todas sus sesiones (los informes son de EQUIPO).
    const sessionsById = new Map<string, any>()
    const sessionIds: string[] = []
    if (campaignId) {
      const { data: sess } = await supabase
        .from('sessions')
        .select('id, patient_id, campaign_id, sport_id')
        .eq('campaign_id', campaignId)
        .eq('clinic_id', profile.clinic_id)
      for (const s of sess || []) { sessionsById.set((s as any).id, s); sessionIds.push((s as any).id) }
      if (!sessionIds.length) return NextResponse.json({ recovered: 0, refinalized: 0, candidates: 0 })
    }

    let query = supabase
      .from('reports')
      .select('id, patient_id, session_id, status, report_data, patients(full_name, date_of_birth, gender, team_id, sport_id)')
      .eq('clinic_id', profile.clinic_id)
      .eq('scope', 'individual')
    query = campaignId ? query.in('session_id', sessionIds) : query.eq('status', 'error')
    const { data: reports } = await query

    let recovered = 0
    let refinalized = 0
    for (const r of (reports || []) as any[]) {
      const rd = r.report_data || {}
      const isTeam = !!campaignId // con campaña, todos son de equipo
      const isError = r.status === 'error' && typeof rd._raw_response === 'string' && rd._raw_response.length > 0
      const isBrokenDraft = r.status === 'draft' && isTeam && !rd._template
      if (!isError && !isBrokenDraft) continue

      let data: any
      if (isError) {
        try { data = parseReportJson(rd._raw_response) } catch { continue } // ni reparando: regenerar
        data = restorePatientName(data, (r.patients as any)?.full_name || '')
      } else {
        data = { ...rd } // ya parseado; solo hay que re-envolver
      }
      delete data._error; delete data._raw_response; delete data._stop_reason; delete data._metricas; delete data._template; delete data.perfil

      if (isTeam) {
        const session = sessionsById.get(r.session_id)
        const { data: anam } = await supabase
          .from('anamnesis_forms')
          .select('form_data')
          .eq('patient_id', r.patient_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const perfil = await buildTeamPerfil(supabase, r.patients, session, anam)
        data.descargo = DESCARGO_TEAM
        data = { _template: 'team_performance', perfil, ...data }
      } else {
        data.descargo = DESCARGO_INDIVIDUAL
      }

      const { error } = await supabase.from('reports').update({ status: 'draft', report_data: data }).eq('id', r.id)
      if (!error) { if (isError) recovered++; else refinalized++ }
    }

    return NextResponse.json({ recovered, refinalized, candidates: (reports || []).length })
  } catch (e: any) {
    console.error('recover-failed error:', e)
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
}
