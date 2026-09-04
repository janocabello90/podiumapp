import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseReportJson } from '@/lib/reports/parseReportJson'
import { restorePatientName } from '@/lib/reports/redact'

// Recupera informes individuales en 'error' cuya respuesta de la IA SÍ se guardó
// (report_data._raw_response) pero no se pudo parsear en su momento. Ahora, con el
// parser que repara (jsonrepair), reintentamos el parseo SOBRE EL TEXTO GUARDADO
// → sin volver a llamar a la IA (coste 0). Los que no tengan texto guardado (p. ej.
// los que fallaron por saldo) no se pueden recuperar aquí; hay que regenerarlos.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const campaignId: string | undefined = body?.campaignId

    const { data: errored } = await supabase
      .from('reports')
      .select('id, patient_id, session_id, report_data, patients(full_name)')
      .eq('clinic_id', profile.clinic_id)
      .eq('scope', 'individual')
      .eq('status', 'error')

    let candidates = (errored || []).filter(
      (r: any) => r.report_data && typeof r.report_data._raw_response === 'string' && r.report_data._raw_response.length > 0
    )

    // Filtrar por campaña (vía la sesión del informe) si se indica.
    if (campaignId) {
      const sids = candidates.map((r: any) => r.session_id).filter(Boolean)
      if (!sids.length) candidates = []
      else {
        const { data: sess } = await supabase.from('sessions').select('id, campaign_id').in('id', sids)
        const inCampaign = new Set((sess || []).filter((s: any) => s.campaign_id === campaignId).map((s: any) => s.id))
        candidates = candidates.filter((r: any) => r.session_id && inCampaign.has(r.session_id))
      }
    }

    let recovered = 0
    let stillFailed = 0
    for (const r of candidates as any[]) {
      let data: any
      try {
        data = parseReportJson(r.report_data._raw_response)
      } catch {
        stillFailed++
        continue // ni siquiera reparando: habrá que regenerarlo
      }
      // Restituir el nombre real (la IA solo vio «[[PACIENTE]]») y limpiar marcadores.
      data = restorePatientName(data, (r.patients as any)?.full_name || '')
      if (data && typeof data === 'object') {
        delete data._error; delete data._raw_response; delete data._stop_reason; delete data._metricas
      }
      const { error } = await supabase.from('reports').update({ status: 'draft', report_data: data }).eq('id', r.id)
      if (error) stillFailed++
      else recovered++
    }

    return NextResponse.json({ recovered, stillFailed, candidates: candidates.length })
  } catch (e: any) {
    console.error('recover-failed error:', e)
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
}
