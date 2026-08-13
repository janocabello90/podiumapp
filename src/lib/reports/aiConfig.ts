// Configuración central de la IA para la generación de informes.
// Un único sitio para el modelo, el presupuesto de tokens y el pensamiento/esfuerzo,
// para no tenerlos hardcodeados en cada ruta (ver CLAUDE.md §11.8).
//
// Nota sobre el pensamiento (thinking) + max_tokens: en Sonnet 5 el pensamiento va
// ACTIVADO. `max_tokens` es el tope TOTAL de pensamiento + texto del informe juntos.
// El informe ocupa ~4.500–5.000 tokens; con pensamiento, 8.000 se quedaba corto y podía
// cortarse. Por eso 16.000 + streaming (evita timeouts con topes altos).

// Modelo de generación de informes (individual, sesión y campaña).
export const REPORT_MODEL = 'claude-sonnet-5'

// Tope total de salida (pensamiento + texto). Amplio para no cortar el informe.
export const REPORT_MAX_TOKENS = 16000

// Pensamiento adaptativo: el modelo decide cuánto razonar antes de escribir.
export const REPORT_THINKING = { type: 'adaptive' as const }

// Profundidad de razonamiento: 'high' = equilibrio calidad/coste/latencia.
export const REPORT_EFFORT = { effort: 'high' as const }

// Precio por millón de tokens (USD) por modelo, para mostrar el coste orientativo
// de cada informe en la UI. Sonnet 5 va con el precio PROMOCIONAL ($2/$10) hasta el
// 31-ago-2026; a partir de septiembre será $3/$15 (ajustar aquí cuando toque).
export const MODEL_PRICING_USD: Record<string, { in: number; out: number }> = {
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-sonnet-4-20250514': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
}

// Tipo de cambio orientativo USD→EUR (solo para mostrar; no es contable).
export const USD_TO_EUR = 0.92

// Coste orientativo de un informe a partir de sus tokens de entrada/salida.
export function estimateReportCost(model: string, inTokens: number, outTokens: number) {
  const p = MODEL_PRICING_USD[model] || MODEL_PRICING_USD[REPORT_MODEL]
  const usd = (inTokens / 1_000_000) * p.in + (outTokens / 1_000_000) * p.out
  return { usd, eur: usd * USD_TO_EUR, pricing: p }
}
