// Detección de valores ATÍPICOS en el informe de equipo, para avisar al fisio en la vista de
// revisión (NO en el PDF): un dato muy fuera de lo normal suele ser un error de lectura del PDF
// de VALD y conviene comprobarlo antes de aprobar. Combina dos reglas:
//  - fuera de rango fisiológico (topes sensatos por métrica), y
//  - outlier extremo frente al propio grupo (> Q3 + 3·IQR o < Q1 - 3·IQR).

export interface DataAlert {
  nombre: string
  metrica: string
  valor: number
  unidad: string
  motivo: string
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}

type MetricDef = { key: string; label: string; unit: string; min?: number; max?: number; from: 'rend' | 'sem' }

const METRICS: MetricDef[] = [
  { key: 'salto', label: 'Salto CMJ', unit: 'cm', min: 8, max: 60, from: 'rend' },
  { key: 'rsi', label: 'RSI (drop jump)', unit: '', min: 0.1, max: 4, from: 'rend' },
  { key: 'dorsi', label: 'Dorsiflexión de tobillo', unit: '°', min: 3, max: 60, from: 'rend' },
  { key: 'hq', label: 'Ratio isquios/cuádriceps', unit: '', min: 0.2, max: 1.6, from: 'rend' },
  { key: 'addabd', label: 'Ratio aductor/abductor', unit: '', min: 0.3, max: 2.5, from: 'rend' },
  { key: 'valgo', label: 'Valgo de rodilla', unit: '°', min: 0, max: 40, from: 'rend' },
  { key: 'fuerzaRel', label: 'Fuerza relativa de isquios', unit: 'N/kg', min: 1, max: 8, from: 'rend' },
  { key: 'maxAsim', label: 'Asimetría máxima', unit: '%', min: 0, max: 70, from: 'sem' },
]

export function detectDataAlerts(rendimiento: any[] | undefined, semaforo: any[] | undefined): DataAlert[] {
  const alerts: DataAlert[] = []
  for (const m of METRICS) {
    const src = (m.from === 'rend' ? rendimiento : semaforo) || []
    const rows = src
      .map((r) => ({ nombre: String(r?.nombre || ''), v: Number(r?.[m.key]) }))
      .filter((r) => Number.isFinite(r.v))
    if (rows.length === 0) continue
    // Outlier extremo frente al grupo (si hay muestra suficiente).
    let hi = Infinity, lo = -Infinity
    if (rows.length >= 5) {
      const vals = rows.map((r) => r.v).sort((a, b) => a - b)
      const q1 = quantile(vals, 0.25), q3 = quantile(vals, 0.75), iqr = q3 - q1
      if (iqr > 0) { hi = q3 + 3 * iqr; lo = q1 - 3 * iqr }
    }
    for (const r of rows) {
      const hard = (m.min != null && r.v < m.min) || (m.max != null && r.v > m.max)
      const stat = r.v > hi || r.v < lo
      if (hard || stat) {
        alerts.push({
          nombre: r.nombre,
          metrica: m.label,
          valor: Math.round(r.v * 100) / 100,
          unidad: m.unit,
          motivo: hard ? 'fuera de rango fisiológico' : 'valor atípico frente al grupo',
        })
      }
    }
  }
  return alerts
}
