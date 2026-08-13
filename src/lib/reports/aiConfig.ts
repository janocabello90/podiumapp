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
