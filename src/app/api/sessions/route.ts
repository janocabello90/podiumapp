import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveSport } from '@/lib/clinical/sport'

// POST /api/sessions  { patientId }
// Crea una sesión de valoración para el paciente y, si hay deporte resuelto
// (paciente ?? equipo), genera las `session_tests` a partir del mapeo deporte→pruebas.
// Deporte a nivel de sesión se puede fijar/override después.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, clinic_id')
      .eq('id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { patientId, campaignId } = await request.json()
    if (!patientId) return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })

    // Paciente (scoped por clínica) + resolución de deporte (paciente ?? equipo)
    const { data: patient } = await supabase
      .from('patients')
      .select('id, clinic_id, sport_id, team_id')
      .eq('id', patientId)
      .eq('clinic_id', profile.clinic_id)
      .single()
    if (!patient) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    let teamSportId: string | null = null
    if (patient.team_id) {
      const { data: team } = await supabase.from('teams').select('sport_id').eq('id', patient.team_id).single()
      teamSportId = (team as any)?.sport_id ?? null
    }
    const sportId = resolveSport({ patientSportId: patient.sport_id, teamSportId })

    // session_number = siguiente
    const { data: last } = await supabase
      .from('sessions')
      .select('session_number')
      .eq('patient_id', patientId)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextNumber = ((last as any)?.session_number ?? 0) + 1

    // Crear sesión
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .insert({
        clinic_id: profile.clinic_id,
        patient_id: patientId,
        physio_id: profile.id,
        sport_id: sportId,
        campaign_id: campaignId || null,
        session_number: nextNumber,
        status: 'in_progress',
        clinical_data: {},
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (sErr || !session) return NextResponse.json({ error: sErr?.message || 'Error al crear la sesión' }, { status: 500 })

    // Generar session_tests del deporte (con snapshot del nombre)
    if (sportId) {
      const { data: mapping } = await supabase
        .from('sport_tests')
        .select('test_id, display_order, is_required, tests(name)')
        .eq('sport_id', sportId)
        .eq('clinic_id', profile.clinic_id)
        .order('display_order', { ascending: true })
      const rows = (mapping || []).map((m: any) => ({
        clinic_id: profile.clinic_id,
        session_id: session.id,
        test_id: m.test_id,
        test_name: m.tests?.name ?? 'Prueba',
        display_order: m.display_order ?? 0,
        is_required: !!m.is_required,
        status: 'pending',
      }))
      if (rows.length > 0) {
        const { error: stErr } = await supabase.from('session_tests').insert(rows)
        if (stErr) console.error('session_tests insert error:', stErr.message)
      }
    }

    return NextResponse.json({ sessionId: session.id })
  } catch (error: any) {
    console.error('Create session error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
