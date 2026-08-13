import type { jsPDF } from 'jspdf'

// Dibuja UNA línea justificada repartiendo el espacio sobrante entre las palabras.
// jsPDF no justifica bien líneas sueltas (trata cada llamada como "última línea" y la
// deja a la izquierda), por eso lo hacemos a mano: medimos el ancho de las palabras y
// repartimos el hueco restante en los espacios. La ÚLTIMA línea de un párrafo NO debe
// justificarse (quien llama la dibuja con doc.text normal) para no dejar huecos enormes.
// Si la línea tiene una sola palabra o el hueco sería exagerado, cae a alineación normal.
export function drawJustifiedLine(doc: jsPDF, line: string, x: number, y: number, maxWidth: number) {
  const words = line.split(/\s+/).filter(Boolean)
  if (words.length <= 1) { doc.text(line, x, y); return }
  const wordsWidth = words.reduce((s, w) => s + doc.getTextWidth(w), 0)
  const gap = (maxWidth - wordsWidth) / (words.length - 1)
  if (gap <= 0 || gap > doc.getTextWidth(' ') * 6) { doc.text(line, x, y); return }
  let cx = x
  for (const w of words) { doc.text(w, cx, y); cx += doc.getTextWidth(w) + gap }
}
