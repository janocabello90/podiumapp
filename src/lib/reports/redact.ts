// Seudonimización del nombre del paciente antes de enviar el contexto a la IA.
//
// Objetivo (privacidad / protección de datos): la IA NO debe recibir el nombre real.
// Se sustituye por un marcador estable y, al recibir el informe, se restituye en local.
//   1) redactPatientName(texto, nombre)  → cambia el nombre (completo y sus partes) por PATIENT_TOKEN
//   2) la IA genera el informe usando el marcador
//   3) restorePatientName(reportData, nombre) → devuelve el nombre real en el resultado

export const PATIENT_TOKEN = '[[PACIENTE]]'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Devuelve las "piezas" del nombre que merece la pena redactar: el nombre completo
// y cada palabra de 3+ letras (evita reemplazar partículas cortas tipo "de", "la").
function nameParts(fullName: string): string[] {
  const trimmed = (fullName || '').trim()
  if (!trimmed) return []
  const words = trimmed.split(/\s+/).filter((w) => w.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '').length >= 3)
  // El nombre completo primero (para que "Ana García" → un solo marcador, no dos).
  return [trimmed, ...words]
}

// Reemplaza en `text` un nombre (completo y por palabras) por un marcador dado.
// Case-insensitive y con límites de palabra en las piezas sueltas.
export function redactNameWith(text: string, fullName: string, token: string): string {
  if (!text || !fullName) return text
  let out = text
  const parts = nameParts(fullName)
  // full name (sin \b para tolerar puntuación alrededor)
  if (parts.length > 0) {
    out = out.replace(new RegExp(escapeRegExp(parts[0]), 'gi'), token)
  }
  for (const p of parts.slice(1)) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(p)}\\b`, 'gi'), token)
  }
  return out
}

// Caso individual: redacta el nombre del paciente con el marcador estándar.
export function redactPatientName(text: string, fullName: string): string {
  return redactNameWith(text, fullName, PATIENT_TOKEN)
}

// Caso agregado (informe de estudio): redacta VARIOS nombres, cada uno con su marcador.
// Redacta primero los nombres completos más largos para minimizar colisiones parciales.
export function redactManyNames(text: string, entries: { name: string; token: string }[]): string {
  let out = text
  const ordered = [...entries].sort((a, b) => (b.name || '').length - (a.name || '').length)
  for (const e of ordered) out = redactNameWith(out, e.name, e.token)
  return out
}

// Restituye varios marcadores por sus nombres reales en un objeto (report_data).
export function restoreManyNames<T>(reportData: T, entries: { name: string; token: string }[]): T {
  try {
    let json = JSON.stringify(reportData)
    for (const e of entries) {
      if (e.token && json.includes(e.token)) json = json.split(e.token).join(e.name)
    }
    return JSON.parse(json)
  } catch {
    return reportData
  }
}

// Restituye el nombre real en un objeto de informe (report_data) sustituyendo el marcador.
// Trabaja sobre el JSON serializado para cubrir todas las cadenas anidadas.
export function restorePatientName<T>(reportData: T, fullName: string): T {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'el paciente'
  try {
    const json = JSON.stringify(reportData)
    if (!json.includes(PATIENT_TOKEN)) return reportData
    return JSON.parse(json.split(PATIENT_TOKEN).join(firstName))
  } catch {
    return reportData
  }
}
