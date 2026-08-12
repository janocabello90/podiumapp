// Referencias / baremos normativos por deporte: utilidades de compatibilidad y de formato
// para inyectarlas (como TEXTO, no PDF) en el contexto de la IA al generar un informe.

export type SexOpt = 'male' | 'female' | 'any' | null

export const SEX_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  any: 'Cualquiera',
}

export function sexLabel(sex?: string | null): string {
  return sex ? SEX_LABELS[sex] ?? sex : 'Cualquiera'
}

// Edad a partir de la fecha de nacimiento (ISO). null si no hay o es inválida.
export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export interface ReferenceLike {
  sex?: string | null
  age_min?: number | null
  age_max?: number | null
}

// ¿Encaja la referencia con el perfil del jugador? Dimensiones: sexo + rango de edad.
// (nivel/fase NO se evalúan aquí: son informativos y no bloquean.)
// Devuelve compatible + motivos de desajuste (para avisar sin impedir la vinculación).
export function referenceCompatibility(
  ref: ReferenceLike,
  patient: { gender?: string | null; age?: number | null },
): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (ref.sex && ref.sex !== 'any' && patient.gender && ref.sex !== patient.gender) {
    reasons.push(`sexo (baremo: ${sexLabel(ref.sex)})`)
  }
  if (patient.age != null) {
    if (ref.age_min != null && patient.age < ref.age_min) reasons.push(`edad < ${ref.age_min}`)
    if (ref.age_max != null && patient.age > ref.age_max) reasons.push(`edad > ${ref.age_max}`)
  }
  return { compatible: reasons.length === 0, reasons }
}

// Texto compacto que describe el perfil de una referencia (para la UI y el prompt).
export function referenceProfileText(ref: {
  sex?: string | null
  age_min?: number | null
  age_max?: number | null
  level?: string | null
  phase?: string | null
  season?: string | null
}): string {
  const bits: string[] = []
  bits.push(`sexo: ${sexLabel(ref.sex)}`)
  if (ref.age_min != null || ref.age_max != null) {
    bits.push(`edad: ${ref.age_min ?? '—'}-${ref.age_max ?? '—'}`)
  }
  if (ref.level) bits.push(`nivel: ${ref.level}`)
  if (ref.phase) bits.push(`fase: ${ref.phase}`)
  if (ref.season) bits.push(`temporada: ${ref.season}`)
  return bits.join(' · ')
}

export interface ReferenceForContext {
  name: string
  sex?: string | null
  age_min?: number | null
  age_max?: number | null
  level?: string | null
  phase?: string | null
  season?: string | null
  prompt?: string | null
  body_md?: string | null
}

// Bloque de texto que se añade al prompt de la IA por cada referencia adjuntada.
export function buildReferencesContext(refs: ReferenceForContext[]): string {
  if (!refs.length) return ''
  const blocks = refs.map((r) => {
    const parts: string[] = [`----- REFERENCIA / BAREMO: ${r.name} -----`]
    parts.push(`(Perfil de la referencia — ${referenceProfileText(r)})`)
    if (r.prompt && r.prompt.trim()) parts.push(`CÓMO USARLA: ${r.prompt.trim()}`)
    parts.push((r.body_md || '').trim())
    return parts.join('\n')
  })
  return `===== REFERENCIAS NORMATIVAS DEL DEPORTE (baremos) =====
Compara los valores objetivos del jugador contra estos baremos cuando aporten contexto.
IMPORTANTE: cada baremo representa una población concreta (sexo, edad, nivel); si el jugador
no encaja del todo con esa población, dilo explícitamente y matiza la comparación. No fuerces
percentiles si la población no es comparable.

${blocks.join('\n\n')}`
}
