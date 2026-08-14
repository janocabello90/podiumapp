// Capa de "datos objetivos" (métricas por prueba).
// - La definición de QUÉ métricas tiene una prueba vive en tests.result_schema (config).
// - Los VALORES extraídos por la IA (y validados por el fisio) viven en session_tests.result_data.
// Este módulo centraliza los tipos y helpers usados por la generación del individual (extracción)
// y por el informe de equipo (agregación).

export interface MetricDef {
  key: string
  label: string
  unit?: string
  bilateral?: boolean // true = tiene valor izq/der; false = un único valor
  percentil?: boolean // true = además hay percentil poblacional
}

// tests.result_schema  ->  { metrics: MetricDef[] }
export function parseMetricsSchema(raw: unknown): MetricDef[] {
  const obj = raw as any
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.metrics)) return []
  return obj.metrics
    .filter((m: any) => m && typeof m.key === 'string' && typeof m.label === 'string')
    .map((m: any) => ({
      key: String(m.key),
      label: String(m.label),
      unit: m.unit ? String(m.unit) : undefined,
      bilateral: !!m.bilateral,
      percentil: !!m.percentil,
    }))
}

// Forma esperada de una métrica (para instruir a la IA y para pintar la tabla).
function shapeHint(m: MetricDef): string {
  if (m.bilateral) return m.percentil ? '{ "izq": n, "der": n, "pct_izq": n, "pct_der": n }' : '{ "izq": n, "der": n }'
  return m.percentil ? '{ "valor": n, "percentil": n, "lado": "izq|der" }' : '{ "valor": n, "lado": "izq|der" }'
}

// Bloque de instrucción para que la IA extraiga las métricas de las pruebas dadas.
// Devuelve '' si ninguna prueba tiene métricas definidas (→ no se pide nada y el individual
// se genera exactamente igual que antes).
export function buildMetricsInstruction(tests: { test_name: string; metrics: MetricDef[] }[]): string {
  const withMetrics = tests.filter((t) => t.metrics.length > 0)
  if (withMetrics.length === 0) return ''
  const lines = withMetrics
    .map((t) => {
      const ms = t.metrics.map((m) => `   · ${m.key} (${m.label}${m.unit ? `, ${m.unit}` : ''}): ${shapeHint(m)}`).join('\n')
      return `PRUEBA "${t.test_name}":\n${ms}`
    })
    .join('\n')
  return `\n\n===== MÉTRICAS OBJETIVAS A EXTRAER (además del informe) =====
Lee las GRÁFICAS DE VALD adjuntas y extrae los VALORES numéricos de estas métricas por prueba.
Añádelo al JSON bajo la clave "_metricas": un array de objetos { "prueba": "<nombre EXACTO de la prueba>", "valores": { <key>: <forma indicada> } }.
Reglas ESTRICTAS: usa el número tal cual aparece en la gráfica; si un valor no aparece, ponlo a null; NUNCA inventes; "lado" = "izq" o "der" (el lado mayor/favorable) cuando aplique.

${lines}`
}

// Empareja el "_metricas" devuelto por la IA con las session_tests (por nombre exacto de prueba).
export function metricsByTestName(rawMetricas: unknown): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>()
  if (Array.isArray(rawMetricas)) {
    for (const item of rawMetricas as any[]) {
      if (item && typeof item.prueba === 'string' && item.valores && typeof item.valores === 'object') {
        map.set(String(item.prueba).trim(), item.valores)
      }
    }
  }
  return map
}

// ===== Agregación de EQUIPO (calculada en código, la IA no inventa cifras) =====

// Umbrales v1 para marcar jugadores destacados (configurable en el futuro).
export const TEAM_THRESHOLDS = { asimetria: 15, percentil: 30 }

export interface PlayerMetrics {
  nombre: string
  tests: { test_name: string; metrics: MetricDef[]; values: Record<string, any> }[]
}

export interface TeamMetricStat {
  test_name: string
  key: string
  label: string
  unit?: string
  bilateral: boolean
  percentil: boolean
  n: number
  mean: number | null
  min: number | null
  max: number | null
  mean_izq: number | null
  mean_der: number | null
  outliers: { nombre: string; detalle: string }[]
  valores: { nombre: string; texto: string }[]
}

const toNum = (x: any): number | null => { const n = Number(x); return Number.isFinite(n) ? n : null }
const avg = (ns: number[]): number | null => (ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 100) / 100 : null)

// Agrega, por (prueba, métrica), las cifras de los jugadores incluidos: media/rango, medias por
// lado (bilateral) y jugadores destacados (asimetría alta o percentil bajo).
export function computeTeamMetrics(players: PlayerMetrics[]): TeamMetricStat[] {
  const testOrder: string[] = []
  const defs = new Map<string, Map<string, MetricDef>>()
  for (const p of players) {
    for (const t of p.tests) {
      if (!defs.has(t.test_name)) { defs.set(t.test_name, new Map()); testOrder.push(t.test_name) }
      const md = defs.get(t.test_name)!
      for (const m of t.metrics) if (!md.has(m.key)) md.set(m.key, m)
    }
  }
  const stats: TeamMetricStat[] = []
  for (const test_name of testOrder) {
    for (const [key, m] of Array.from(defs.get(test_name)!)) {
      const valores: { nombre: string; texto: string }[] = []
      const outliers: { nombre: string; detalle: string }[] = []
      const singles: number[] = [], izqs: number[] = [], ders: number[] = []
      for (const p of players) {
        const v = p.tests.find((x) => x.test_name === test_name)?.values?.[key]
        if (!v) continue
        if (m.bilateral) {
          const izq = toNum(v.izq), der = toNum(v.der)
          if (izq != null) izqs.push(izq)
          if (der != null) ders.push(der)
          if (izq != null || der != null) valores.push({ nombre: p.nombre, texto: `izq ${izq ?? '—'} / der ${der ?? '—'}` })
          if (m.percentil) {
            const cand = [toNum(v.pct_izq), toNum(v.pct_der)].filter((x): x is number => x != null)
            const worst = cand.length ? Math.min(...cand) : null
            if (worst != null && worst < TEAM_THRESHOLDS.percentil) outliers.push({ nombre: p.nombre, detalle: `percentil ${worst}` })
          }
        } else {
          const val = toNum(v.valor)
          if (val != null) { singles.push(val); valores.push({ nombre: p.nombre, texto: `${val}${m.unit || ''}` }) }
          const pct = toNum(v.percentil)
          if (m.percentil && pct != null && pct < TEAM_THRESHOLDS.percentil) outliers.push({ nombre: p.nombre, detalle: `percentil ${pct}` })
          if ((m.unit === '%' || key.toLowerCase().includes('asim')) && val != null && Math.abs(val) >= TEAM_THRESHOLDS.asimetria) outliers.push({ nombre: p.nombre, detalle: `${val}%` })
        }
      }
      if (valores.length === 0) continue
      stats.push({
        test_name, key, label: m.label, unit: m.unit, bilateral: !!m.bilateral, percentil: !!m.percentil,
        n: valores.length,
        mean: m.bilateral ? null : avg(singles),
        min: m.bilateral || !singles.length ? null : Math.min(...singles),
        max: m.bilateral || !singles.length ? null : Math.max(...singles),
        mean_izq: m.bilateral ? avg(izqs) : null,
        mean_der: m.bilateral ? avg(ders) : null,
        outliers, valores,
      })
    }
  }
  return stats
}
