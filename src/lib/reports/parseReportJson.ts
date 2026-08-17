// Extrae y parsea el JSON del informe desde la respuesta del modelo, tolerando:
// - preámbulo/epílogo en prosa alrededor del JSON,
// - valla de código ```json … ``` (bien cerrada o SIN cerrar por truncado),
// - texto sin valla (primer "{" … último "}").
// Prueba varios candidatos en orden y devuelve el primero que parsea.
// Lanza 'NO_JSON' si ninguno es JSON válido (p. ej. respuesta truncada a medias).
export function parseReportJson(responseText: string): any {
  const text = (responseText || '').trim()
  const candidates: string[] = []

  // 1) Valla ```json … ``` bien cerrada (caso normal).
  const fencedClosed = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fencedClosed) candidates.push(fencedClosed[1])

  // 2) Valla abierta sin cerrar (respuesta truncada): desde ```json hasta el final.
  const fencedOpen = text.match(/```(?:json)?\s*([\s\S]*)$/)
  if (fencedOpen) candidates.push(fencedOpen[1])

  // 3) Del primer "{" al último "}" (ignora preámbulo/epílogo en prosa).
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1))

  // 4) El texto tal cual.
  candidates.push(text)

  for (const c of candidates) {
    const s = c.trim()
    if (!s) continue
    try {
      return JSON.parse(s)
    } catch {
      /* siguiente candidato */
    }
  }
  throw new Error('NO_JSON')
}
