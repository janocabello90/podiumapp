'use client'

// Gráficos del informe de equipo (SVG puro, sin librerías). Todo sale del report_data ya
// calculado (semáforo, panel, lesiones): nada estimado por IA.

type RiskLevel = 'rojo' | 'ambar' | 'verde'
interface PlayerRisk { nombre: string; maxAsim: number | null; worstPct?: number | null; nivel: RiskLevel }
interface MetricStat { test_name: string; label: string; key: string; bilateral: boolean; mean: number | null; unit?: string }
interface Injuries { zonas?: { zona: string; n: number }[] }

const RISK_COLOR: Record<RiskLevel, string> = { rojo: '#dc2626', ambar: '#d97706', verde: '#16a34a' }

function short(name: string, n = 18) {
  const s = name.trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// Barras horizontales genéricas.
function HBars({ data, unit = '', height }: { data: { label: string; value: number; color: string }[]; unit?: string; height?: number }) {
  if (!data.length) return null
  const rowH = 20, labelW = 118, chartW = 330, padR = 34
  const w = labelW + chartW + padR
  const h = height ?? data.length * rowH + 6
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxWidth: '100%' }} role="img">
      {data.map((d, i) => {
        const y = i * rowH + 4
        const bw = (d.value / max) * chartW
        return (
          <g key={i}>
            <text x={labelW - 6} y={y + rowH / 2 - 3} textAnchor="end" dominantBaseline="middle" fontSize="10.5" fill="#475569">{short(d.label)}</text>
            <rect x={labelW} y={y} width={chartW} height={rowH - 8} rx="3" fill="#f1f5f9" />
            <rect x={labelW} y={y} width={bw} height={rowH - 8} rx="3" fill={d.color} />
            <text x={labelW + bw + 4} y={y + (rowH - 8) / 2} dominantBaseline="middle" fontSize="9.5" fill="#334155">{Math.round(d.value)}{unit}</text>
          </g>
        )
      })}
    </svg>
  )
}

function StackedRisk({ rojo, ambar, verde, sinDatos = 0 }: { rojo: number; ambar: number; verde: number; sinDatos?: number }) {
  const total = rojo + ambar + verde + sinDatos
  if (total === 0) return null
  const w = 480, h = 26
  const segs = [
    { n: rojo, c: RISK_COLOR.rojo, label: 'Riesgo alto' },
    { n: ambar, c: RISK_COLOR.ambar, label: 'Riesgo medio' },
    { n: verde, c: RISK_COLOR.verde, label: 'Sin señales' },
    { n: sinDatos, c: '#9ca3af', label: 'Sin datos VALD' },
  ].filter((s) => s.n > 0)
  let x = 0
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
        {segs.map((s, i) => {
          const sw = (s.n / total) * w
          const el = (
            <g key={i}>
              <rect x={x} y={0} width={sw} height={h} fill={s.c} rx={i === 0 || i === segs.length - 1 ? 4 : 0} />
              {sw > 22 && <text x={x + sw / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#fff" fontWeight="600">{s.n}</text>}
            </g>
          )
          x += sw
          return el
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segs.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.c }} /> {s.label}: <strong>{s.n}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">{title}</p>
      {children}
    </div>
  )
}

export default function TeamCharts({ semaforo = [], panel = [], lesiones }: { semaforo?: PlayerRisk[]; panel?: MetricStat[]; lesiones?: Injuries }) {
  // 1) Asimetría por jugador (con dato), ordenada desc.
  // Color por la propia ASIMETRÍA (no por el riesgo global), para que coincida con la barra.
  const asimColor = (v: number) => (v >= 30 ? RISK_COLOR.rojo : v >= 15 ? RISK_COLOR.ambar : RISK_COLOR.verde)
  const asimJug = semaforo
    .filter((p) => p.maxAsim != null)
    .sort((a, b) => (b.maxAsim as number) - (a.maxAsim as number))
    .map((p) => ({ label: p.nombre, value: p.maxAsim as number, color: asimColor(p.maxAsim as number) }))

  // 2) Reparto de riesgo (los que no tienen ni asimetría ni percentil = "sin datos", no verde).
  const isNoData = (p: PlayerRisk) => p.maxAsim == null && p.worstPct == null
  const rojo = semaforo.filter((p) => p.nivel === 'rojo' && !isNoData(p)).length
  const ambar = semaforo.filter((p) => p.nivel === 'ambar' && !isNoData(p)).length
  const verde = semaforo.filter((p) => p.nivel === 'verde' && !isNoData(p)).length
  const sinDatos = semaforo.filter(isNoData).length

  // 3) Asimetría media por prueba (métricas de asimetría del panel).
  const asimPrueba = panel
    .filter((s) => /asim/i.test(s.key) && !s.bilateral && s.mean != null)
    .map((s) => ({ label: s.test_name, value: s.mean as number, color: '#2563eb' }))
    .sort((a, b) => b.value - a.value)

  // 4) Lesiones por zona.
  const zonas = (lesiones?.zonas || []).slice(0, 8).map((z) => ({ label: z.zona, value: z.n, color: '#0891b2' }))

  const nada = asimJug.length === 0 && rojo + ambar + verde + sinDatos === 0 && asimPrueba.length === 0 && zonas.length === 0
  if (nada) return <p className="text-xs text-gray-400">Sin datos suficientes para los gráficos.</p>

  return (
    <div className="space-y-3">
      {rojo + ambar + verde + sinDatos > 0 && <ChartCard title="Reparto de riesgo del equipo"><StackedRisk rojo={rojo} ambar={ambar} verde={verde} sinDatos={sinDatos} /></ChartCard>}
      {asimJug.length > 0 && (
        <ChartCard title="Asimetría máxima por jugador (%)">
          <p className="text-[11px] text-gray-400 mb-2">Color por nivel de asimetría: verde &lt;15%, ámbar 15–30%, rojo &gt;30%.</p>
          <HBars data={asimJug} unit="%" />
        </ChartCard>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {asimPrueba.length > 0 && <ChartCard title="Asimetría media por prueba (%)"><HBars data={asimPrueba} unit="%" /></ChartCard>}
        {zonas.length > 0 && <ChartCard title="Lesiones por zona (24 m)"><HBars data={zonas} /></ChartCard>}
      </div>
    </div>
  )
}
