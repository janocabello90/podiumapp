import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ageFromDob, referenceCompatibility, referenceProfileText } from '@/lib/reports/references'

// Devuelve las referencias/baremos disponibles para el informe de un jugador, con un flag de
// compatibilidad (sexo + edad) para avisar sin bloquear. Resuelve el deporte de la sesión →
// paciente → equipo. Si no hay deporte o referencias, devuelve lista vacía.
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const patientId = request.nextUrl.searchParams.get('patientId')
    const sessionId = request.nextUrl.searchParams.get('sessionId')
    if (!patientId) return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })

    const { data: patient } = await supabase
      .from('patients')
      .select('id, gender, date_of_birth, sport_id, team_id')
      .eq('id', patientId)
      .eq('clinic_id', profile.clinic_id)
      .single()
    if (!patient) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    let sessionSportId: string | null = null
    if (sessionId) {
      const { data: session } = await supabase
        .from('sessions')
        .select('sport_id')
        .eq('id', sessionId)
        .eq('clinic_id', profile.clinic_id)
        .single()
      sessionSportId = (session as any)?.sport_id ?? null
    }

    let teamSportId: string | null = null
    if (!sessionSportId && !patient.sport_id && patient.team_id) {
      const { data: team } = await supabase.from('teams').select('sport_id').eq('id', patient.team_id).single()
      teamSportId = (team as any)?.sport_id ?? null
    }

    const sportId = sessionSportId ?? patient.sport_id ?? teamSportId
    if (!sportId) return NextResponse.json({ references: [] })

    const { data: refs } = await supabase
      .from('sport_references')
      .select('id, name, sex, age_min, age_max, level, phase, season')
      .eq('sport_id', sportId)
      .eq('clinic_id', profile.clinic_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    const age = ageFromDob(patient.date_of_birth)
    const references = (refs || []).map((r: any) => {
      const { compatible, reasons } = referenceCompatibility(r, { gender: patient.gender, age })
      return {
        id: r.id,
        name: r.name,
        profile: referenceProfileText(r),
        compatible,
        reasons,
      }
    })

    return NextResponse.json({ references })
  } catch (error: any) {
    console.error('references list error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
