'use client'

// Gráficos del informe de equipo (SVG puro, sin librerías). Todo sale del report_data ya
// calculado (semáforo, panel, lesiones): nada estimado por IA.

type RiskLevel = 'rojo' | 'ambar' | 'verde'
interface PlayerRisk { nombre: string; maxAsim: number | null; worstPct?: number | null; nivel: RiskLevel }
interface MetricStat { test_name: string; label: string; key: string; bilateral: boolean; mean: number | null; unit?: string }
interface Injuries { zonas?: { zona: string; n: number }[] }
interface PerfRow { nombre: string; salto: number | null; rsi: number | null; dorsi: number | null; hq?: number | null; addabd?: number | null; valgo?: number | null; fuerzaRel?: number | null }

const RISK_COLOR: Record<RiskLevel, string> = { rojo: '#dc2626', ambar: '#d97706', verde: '#16a34a' }

function short(name: string, n = 18) {
  const s = name.trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// Barras horizontales genéricas.
function HBars({ data, unit = '', decimals = 0, height }: { data: { label: string; value: number; color: string }[]; unit?: string; decimals?: number; height?: number }) {
  if (!data.length) return null
  const rowH = 20, labelW = 118, chartW = 330, padR = 40
  const w = labelW + chartW + padR
  const h = height ?? data.length * rowH + 6
  const max = Math.max(...data.map((d) => d.value), 0.0001)
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
            <text x={labelW + bw + 4} y={y + (rowH - 8) / 2} dominantBaseline="middle" fontSize="9.5" fill="#334155">{d.value.toFixed(decimals)}{unit}</text>
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

export default function TeamCharts({ semaforo = [], panel = [], lesiones, rendimiento = [] }: { semaforo?: PlayerRisk[]; panel?: MetricStat[]; lesiones?: Injuries; rendimiento?: PerfRow[] }) {
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
  const asimLabel = (s: MetricStat) => {
    const m = (s.label || '').replace(/asimetr[ií]a\s*(de\s*)?/i, '').replace(/\s*\(%\)/, '').trim()
    return m ? `${s.test_name} · ${m}` : s.test_name
  }
  const asimPrueba = panel
    .filter((s) => /asim/i.test(s.key) && !s.bilateral && s.mean != null)
    .map((s) => ({ label: asimLabel(s), value: s.mean as number, color: '#2563eb' }))
    .sort((a, b) => b.value - a.value)

  // 4) Lesiones por zona.
  const zonas = (lesiones?.zonas || []).slice(0, 8).map((z) => ({ label: z.zona, value: z.n, color: '#0891b2' }))

  // 5) Rendimiento (otras capacidades, no asimetría): salto, reactividad, movilidad.
  const saltoData = rendimiento.filter((p) => p.salto != null).sort((a, b) => (b.salto as number) - (a.salto as number)).map((p) => ({ label: p.nombre, value: p.salto as number, color: '#0d9488' }))
  const rsiData = rendimiento.filter((p) => p.rsi != null).sort((a, b) => (b.rsi as number) - (a.rsi as number)).map((p) => ({ label: p.nombre, value: p.rsi as number, color: '#4f46e5' }))
  const dorsiData = rendimiento.filter((p) => p.dorsi != null).sort((a, b) => (a.dorsi as number) - (b.dorsi as number)).map((p) => ({ label: p.nombre, value: p.dorsi as number, color: '#ea580c' }))

  // 6) Equilibrio de fuerzas y riesgo articular.
  const hqColor = (v: number) => (v < 0.47 ? '#dc2626' : v < 0.6 ? '#d97706' : '#16a34a')
  const hqData = rendimiento.filter((p) => p.hq != null).sort((a, b) => (a.hq as number) - (b.hq as number)).map((p) => ({ label: p.nombre, value: p.hq as number, color: hqColor(p.hq as number) }))
  const addabdData = rendimiento.filter((p) => p.addabd != null).sort((a, b) => (a.addabd as number) - (b.addabd as number)).map((p) => ({ label: p.nombre, value: p.addabd as number, color: '#7c3aed' }))
  const valgoData = rendimiento.filter((p) => p.valgo != null).sort((a, b) => (b.valgo as number) - (a.valgo as number)).map((p) => ({ label: p.nombre, value: p.valgo as number, color: '#e11d48' }))
  const fuerzaRelData = rendimiento.filter((p) => p.fuerzaRel != null).sort((a, b) => (b.fuerzaRel as number) - (a.fuerzaRel as number)).map((p) => ({ label: p.nombre, value: p.fuerzaRel as number, color: '#0284c7' }))

  const nada = asimJug.length === 0 && rojo + ambar + verde + sinDatos === 0 && asimPrueba.length === 0 && zonas.length === 0
    && saltoData.length === 0 && rsiData.length === 0 && dorsiData.length === 0
    && hqData.length === 0 && addabdData.length === 0 && valgoData.length === 0 && fuerzaRelData.length === 0
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

      {(saltoData.length > 0 || rsiData.length > 0 || dorsiData.length > 0) && (
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-500 mb-2">Rendimiento y capacidades (además de la asimetría)</p>
          <div className="space-y-3">
            {saltoData.length > 0 && <ChartCard title="Salto CMJ (cm) por jugador · más alto = más potencia"><HBars data={saltoData} unit=" cm" /></ChartCard>}
            <div className="grid sm:grid-cols-2 gap-3">
              {rsiData.length > 0 && <ChartCard title="Reactividad · RSI por jugador"><HBars data={rsiData} decimals={2} /></ChartCard>}
              {dorsiData.length > 0 && <ChartCard title="Dorsiflexión de tobillo (°) · lado más limitado"><HBars data={dorsiData} unit="°" /></ChartCard>}
            </div>
          </div>
        </div>
      )}

      {(hqData.length > 0 || addabdData.length > 0 || valgoData.length > 0 || fuerzaRelData.length > 0) && (
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-500 mb-2">Equilibrio de fuerzas y riesgo articular</p>
          <div className="space-y-3">
            {hqData.length > 0 && (
              <ChartCard title="Ratio isquios/cuádriceps (H:Q) por jugador">
                <p className="text-[11px] text-gray-400 mb-2">Referencia ≈ 0,5–0,6. Menor = mayor riesgo de isquios. Color: rojo &lt;0,47, ámbar 0,47–0,6, verde ≥0,6.</p>
                <HBars data={hqData} decimals={2} />
              </ChartCard>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {addabdData.length > 0 && <ChartCard title="Ratio aductor/abductor por jugador"><p className="text-[11px] text-gray-400 mb-2">≈1,0 equilibrado; bajo = posible déficit de aductores.</p><HBars data={addabdData} decimals={2} /></ChartCard>}
              {valgoData.length > 0 && <ChartCard title="Valgo dinámico de rodilla (°) · peor lado"><p className="text-[11px] text-gray-400 mb-2">Mayor ángulo = más valgo (posible riesgo de rodilla).</p><HBars data={valgoData} unit="°" /></ChartCard>}
            </div>
            {fuerzaRelData.length > 0 && (
              <ChartCard title="Fuerza de isquios relativa (N/kg) por jugador · mayor = más fuerza">
                <HBars data={fuerzaRelData} decimals={2} />
              </ChartCard>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
