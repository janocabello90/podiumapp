// Capa "cuadro de mando" del informe de equipo: TODO se calcula en código (cifras deterministas,
// la IA NO las inventa). De aquí salen (a) los bloques que se pintan tal cual (KPIs, semáforo,
// lesiones, anexo) y (b) una SÍNTESIS compacta que se envía a la IA para que redacte la narrativa
// fundamentada (sin volcarle datos crudos).
import { TEAM_THRESHOLDS, type PlayerMetrics, type TeamMetricStat } from './metrics'

export type RiskLevel = 'rojo' | 'ambar' | 'verde'

export interface PlayerRisk {
  nombre: string
  maxAsim: number | null      // mayor asimetría (%) entre sus pruebas
  worstPct: number | null     // percentil más bajo observado
  lesiones: number            // nº de lesiones 24m
  nivel: RiskLevel
  motivos: string[]           // por qué está en ese nivel
}

export interface InjurySummary {
  jugadoresConLesion: number
  totalLesiones: number
  conCirugia: number
  zonas: { zona: string; n: number }[] // zonas normalizadas, top primero
}

export interface TeamKpis {
  valorados: number
  pctAsimetriaAlta: number | null // % de valorados con alguna asimetría > umbral
  conLesion24m: number
  aVigilar: number                // jugadores en rojo o ámbar
}

export interface AnexoRow {
  nombre: string
  nivel: RiskLevel
  metricaClave: string | null // p. ej. "asim 43%" o "CMJ 41 cm"
}

export interface TeamDashboard {
  kpis: TeamKpis
  riesgos: PlayerRisk[]        // ordenados peor→mejor
  lesiones: InjurySummary
  anexo: AnexoRow[]
}

// ---- Utilidades ----
const num = (x: any): number | null => {
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

// Recorre todas las métricas de asimetría de un jugador (claves que contienen "asim") y
// devuelve la mayor en valor absoluto. Las métricas de asimetría guardan { valor, lado }.
function maxAsymmetry(p: PlayerMetrics): number | null {
  let max: number | null = null
  for (const t of p.tests) {
    for (const m of t.metrics) {
      if (!/asim/i.test(m.key)) continue
      const v = (t.values as any)?.[m.key]
      const val = num(v?.valor)
      if (val != null) { const a = Math.abs(val); if (max == null || a > max) max = a }
    }
  }
  return max
}

// Percentil más bajo observado (métricas con percentil: {percentil} o {pct_izq, pct_der}).
function worstPercentile(p: PlayerMetrics): number | null {
  let worst: number | null = null
  for (const t of p.tests) {
    for (const m of t.metrics) {
      if (!m.percentil) continue
      const v = (t.values as any)?.[m.key]
      const cands = [num(v?.percentil), num(v?.pct_izq), num(v?.pct_der)].filter((x): x is number => x != null)
      for (const c of cands) if (worst == null || c < worst) worst = c
    }
  }
  return worst
}

// Normalización ligera de zonas de lesión (celda libre → canónica best-effort).
const ZONE_MAP: [RegExp, string][] = [
  [/tobillo/i, 'Tobillo'],
  [/(rodilla|rodrilla)/i, 'Rodilla'],
  [/(isquio|isqui|femoral post)/i, 'Isquios'],
  [/(cuadriceps|cuádriceps|cuadricep)/i, 'Cuádriceps'],
  [/muslo/i, 'Muslo'],
  [/(gemelo|soleo|sóleo|pantorrilla)/i, 'Gemelo/sóleo'],
  [/(cadera|ingle|adductor|aductor|pubis)/i, 'Cadera/aductores'],
  [/(lumbar|espalda|dorsal|columna)/i, 'Espalda/lumbar'],
  [/(hombro|deltoid|manguito)/i, 'Hombro'],
  [/(pie|dedo|planta|fascitis)/i, 'Pie'],
  [/(mano|muñeca|muneca|dedo)/i, 'Mano/muñeca'],
  [/(cuello|cervical)/i, 'Cuello'],
]
function normalizeZone(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return 'Otras'
  for (const [re, canon] of ZONE_MAP) if (re.test(s)) return canon
  // Capitaliza la primera letra como fallback.
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function levelFromSignals(maxAsim: number | null, worstPct: number | null): { nivel: RiskLevel; motivos: string[] } {
  const motivos: string[] = []
  let nivel: RiskLevel = 'verde'
  const red = TEAM_THRESHOLDS.asimetria * 2 // 30% por defecto
  if (maxAsim != null && maxAsim >= red) { nivel = 'rojo'; motivos.push(`asimetría ${Math.round(maxAsim)}%`) }
  else if (maxAsim != null && maxAsim >= TEAM_THRESHOLDS.asimetria) { nivel = 'ambar'; motivos.push(`asimetría ${Math.round(maxAsim)}%`) }
  if (worstPct != null && worstPct < TEAM_THRESHOLDS.percentil) {
    motivos.push(`percentil ${Math.round(worstPct)}`)
    if (nivel === 'verde') nivel = 'ambar'
  }
  return { nivel, motivos }
}

// injuriesByName: nombre → filas de lesión [{zone, surgery, ...}] (celdas libres).
export function buildTeamDashboard(
  players: PlayerMetrics[],
  panel: TeamMetricStat[],
  injuriesByName: Map<string, any[]>,
): TeamDashboard {
  const riesgos: PlayerRisk[] = players.map((p) => {
    const maxAsim = maxAsymmetry(p)
    const worstPct = worstPercentile(p)
    const lesiones = (injuriesByName.get(p.nombre) || []).length
    const { nivel, motivos } = levelFromSignals(maxAsim, worstPct)
    // Una lesión reciente/con cirugía no cambia el color por sí sola en v1, pero suma motivo.
    if (lesiones > 0) motivos.push(`${lesiones} lesión(es) 24m`)
    return { nombre: p.nombre, maxAsim, worstPct, lesiones, nivel, motivos }
  })
  const rank = (n: RiskLevel) => (n === 'rojo' ? 0 : n === 'ambar' ? 1 : 2)
  riesgos.sort((a, b) => rank(a.nivel) - rank(b.nivel) || (b.maxAsim ?? 0) - (a.maxAsim ?? 0))

  const withAsim = riesgos.filter((r) => r.maxAsim != null)
  const altas = withAsim.filter((r) => (r.maxAsim as number) >= TEAM_THRESHOLDS.asimetria).length
  const kpis: TeamKpis = {
    valorados: players.length,
    pctAsimetriaAlta: withAsim.length ? Math.round((altas / withAsim.length) * 100) : null,
    conLesion24m: Array.from(injuriesByName.values()).filter((rows) => (rows?.length || 0) > 0).length,
    aVigilar: riesgos.filter((r) => r.nivel !== 'verde').length,
  }

  // Lesiones agregadas.
  const zoneCount = new Map<string, number>()
  let total = 0, conCirugia = 0, jugadoresConLesion = 0
  injuriesByName.forEach((rows) => {
    if (!rows || rows.length === 0) return
    jugadoresConLesion++
    for (const r of rows) {
      total++
      const z = normalizeZone(String(r?.zone ?? r?.zona ?? ''))
      zoneCount.set(z, (zoneCount.get(z) || 0) + 1)
      if (/^s[ií]/i.test(String(r?.surgery ?? r?.cirugia ?? ''))) conCirugia++
    }
  })
  const zonas = Array.from(zoneCount.entries()).map(([zona, n]) => ({ zona, n })).sort((a, b) => b.n - a.n)
  const lesiones: InjurySummary = { jugadoresConLesion, totalLesiones: total, conCirugia, zonas }

  // Anexo: métrica clave = mayor asimetría si la hay; si no, primer percentil.
  const anexo: AnexoRow[] = riesgos.map((r) => ({
    nombre: r.nombre,
    nivel: r.nivel,
    metricaClave: r.maxAsim != null ? `asim ${Math.round(r.maxAsim)}%` : r.worstPct != null ? `percentil ${Math.round(r.worstPct)}` : null,
  }))

  return { kpis, riesgos, lesiones, anexo }
}

// Síntesis COMPACTA para la IA: lo justo para que redacte fundamentada, sin datos crudos.
export function buildDashboardSynthesis(d: TeamDashboard): string {
  const lines: string[] = []
  lines.push(`KPIs: ${d.kpis.valorados} valorados · ${d.kpis.pctAsimetriaAlta ?? '—'}% con asimetría alta · ${d.kpis.conLesion24m} con lesión 24m · ${d.kpis.aVigilar} a vigilar.`)
  const rojos = d.riesgos.filter((r) => r.nivel === 'rojo')
  const ambar = d.riesgos.filter((r) => r.nivel === 'ambar')
  if (rojos.length) lines.push(`Riesgo alto (rojo): ${rojos.map((r) => `${r.nombre} (${r.motivos.join(', ')})`).join('; ')}.`)
  if (ambar.length) lines.push(`Riesgo medio (ámbar): ${ambar.map((r) => r.nombre).join(', ')}.`)
  if (d.lesiones.totalLesiones) {
    const z = d.lesiones.zonas.slice(0, 5).map((x) => `${x.zona} ${x.n}`).join(', ')
    lines.push(`Lesiones 24m: ${d.lesiones.totalLesiones} en ${d.lesiones.jugadoresConLesion} jugadores (cirugía: ${d.lesiones.conCirugia}). Zonas: ${z}.`)
  }
  return lines.join('\n')
}
