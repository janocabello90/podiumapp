// Resolución del deporte para una valoración (Fase B; se consumirá en la Fase D).
// Orden de precedencia acordado: sesión → paciente (override) → equipo (default).
// Devuelve el primer `sport_id` no-nulo, o null si no hay deporte en ningún nivel.
//
// Sin consumidor todavía: en la Fase D, la sesión usará el resultado para derivar
// la lista de pruebas (sport_tests). Un deporte null ⇒ sesión sin pruebas
// preconfiguradas (selección manual), sin bloquear el caso individual.

export function resolveSport(input: {
  sessionSportId?: string | null
  patientSportId?: string | null
  teamSportId?: string | null
}): string | null {
  return input.sessionSportId ?? input.patientSportId ?? input.teamSportId ?? null
}
