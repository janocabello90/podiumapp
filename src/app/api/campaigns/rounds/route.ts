import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Ciclo de vida de la RONDA de un equipo dentro de un estudio.
// POST { campaignId, teamId, action: 'close' | 'open' }
//  - 'close': cierra la ronda abierta actual (desbloquea el informe de equipo). Requiere ≥1 informe
//             individual aprobado en la ronda (cobertura parcial permitida).
//  - 'open' : abre la siguiente ronda (round_number = max+1). Requiere que la actual esté cerrada.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: profile } = await supabase.from('users').select('id, clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { campaignId, teamId, action } = await request.json()
    if (!campaignId || !teamId || !['close', 'open'].includes(action)) {
      return NextResponse.json({ error: 'campaignId, teamId y action (close|open) son obligatorios' }, { status: 400 })
    }

    // El equipo debe pertenecer al estudio (y ambos a la clínica).
    const { data: ct } = await supabase
      .from('campaign_teams')
      .select('team_id')
      .eq('campaign_id', campaignId)
      .eq('team_id', teamId)
      .eq('clinic_id', profile.clinic_id)
      .maybeSingle()
    if (!ct) return NextResponse.json({ error: 'El equipo no pertenece a este estudio' }, { status: 400 })

    // Ronda actual = la de mayor round_number.
    const { data: current } = await supabase
      .from('campaign_team_rounds')
      .select('id, round_number, status')
      .eq('campaign_id', campaignId).eq('team_id', teamId).eq('clinic_id', profile.clinic_id)
      .order('round_number', { ascending: false }).limit(1).maybeSingle()

    if (action === 'close') {
      if (!current) return NextResponse.json({ error: 'No hay ninguna ronda que cerrar' }, { status: 400 })
      if ((current as any).status === 'closed') {
        return NextResponse.json({ round: (current as any).round_number, status: 'closed' }) // idempotente
      }
      const round = (current as any).round_number

      // Cobertura parcial: exigir ≥1 individual aprobado en la ronda.
      const { data: roster } = await supabase
        .from('patients').select('id').eq('team_id', teamId).eq('clinic_id', profile.clinic_id).eq('status', 'active')
      const patientIds = (roster || []).map((p: any) => p.id)
      let approvedCount = 0
      if (patientIds.length > 0) {
        const { data: sess } = await supabase
          .from('sessions').select('id')
          .eq('campaign_id', campaignId).eq('campaign_round', round).eq('clinic_id', profile.clinic_id)
          .in('patient_id', patientIds)
        const sessionIds = (sess || []).map((s: any) => s.id)
        if (sessionIds.length > 0) {
          const { count } = await supabase
            .from('reports').select('id', { count: 'exact', head: true })
            .eq('scope', 'individual').eq('status', 'approved').in('session_id', sessionIds)
          approvedCount = count ?? 0
        }
      }
      if (approvedCount < 1) {
        return NextResponse.json({ error: 'Aprueba al menos un informe individual de esta ronda antes de cerrarla.' }, { status: 400 })
      }

      const { error } = await supabase
        .from('campaign_team_rounds')
        .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: profile.id })
        .eq('id', (current as any).id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ round, status: 'closed', approved: approvedCount })
    }

    // action === 'open'
    if (!current) {
      // No hay rondas: abrir la ronda 1 directamente.
      const { data: created, error } = await supabase
        .from('campaign_team_rounds')
        .insert({ clinic_id: profile.clinic_id, campaign_id: campaignId, team_id: teamId, round_number: 1, status: 'open', opened_by: profile.id })
        .select('round_number').single()
      if (error || !created) return NextResponse.json({ error: error?.message || 'No se pudo abrir la ronda' }, { status: 500 })
      return NextResponse.json({ round: (created as any).round_number, status: 'open' })
    }
    if ((current as any).status !== 'closed') {
      return NextResponse.json({ error: 'Cierra la ronda actual antes de abrir una nueva.' }, { status: 409 })
    }
    const next = (current as any).round_number + 1
    const { data: created, error } = await supabase
      .from('campaign_team_rounds')
      .insert({ clinic_id: profile.clinic_id, campaign_id: campaignId, team_id: teamId, round_number: next, status: 'open', opened_by: profile.id })
      .select('round_number').single()
    if (error || !created) return NextResponse.json({ error: error?.message || 'No se pudo abrir la ronda' }, { status: 500 })
    return NextResponse.json({ round: (created as any).round_number, status: 'open' })
  } catch (e: any) {
    console.error('campaign rounds error:', e)
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
}
