import { ageFromDob } from './references'

// Perfil estructurado del deportista para la portada del informe de equipo.
// Mismos datos que usa la generación; compartido para que la RECUPERACIÓN no diverja.
export async function buildTeamPerfil(supabase: any, patient: any, session: any, anamnesis: any) {
  const fd = (anamnesis?.form_data as any) || {}
  let teamName: string | null = null
  let teamCategory: string | null = null
  if (patient?.team_id) {
    const { data: tm } = await supabase.from('teams').select('name, category').eq('id', patient.team_id).single()
    teamName = (tm as any)?.name ?? null
    teamCategory = (tm as any)?.category ?? null
  }
  let sportName: string | null = null
  const sportId = session?.sport_id ?? patient?.sport_id
  if (sportId) {
    const { data: sp } = await supabase.from('sports').select('name').eq('id', sportId).single()
    sportName = (sp as any)?.name ?? null
  }
  let estudioName: string | null = null
  if (session?.campaign_id) {
    const { data: cmp } = await supabase.from('campaigns').select('name').eq('id', session.campaign_id).single()
    estudioName = (cmp as any)?.name ?? null
  }
  const lateralidad = [fd.dominant_leg ? `Pierna ${fd.dominant_leg}` : null, fd.dominant_arm ? `Brazo ${fd.dominant_arm}` : null].filter(Boolean).join(' · ') || null
  return {
    nombre: patient.full_name,
    edad: ageFromDob(patient.date_of_birth),
    sexo: patient.gender === 'male' ? 'Hombre' : patient.gender === 'female' ? 'Mujer' : (fd.sex || null),
    deporte: sportName,
    posicion: fd.position || null,
    categoria: teamCategory,
    altura_cm: fd.height_cm ?? null,
    peso_kg: fd.weight_kg ?? null,
    lateralidad,
    horas_entreno_semana: fd.training_hours_week ?? null,
    equipo: teamName,
    estudio: estudioName,
  }
}
