'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, CheckCircle2, FileDown, Plus, Trash2, BarChart3, SlidersHorizontal, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDuration } from '@/lib/reports/formatDuration'
import TeamCharts from '@/components/report/TeamCharts'
import { detectDataAlerts } from '@/lib/reports/teamAlerts'
import {
  TEAM_PRESETS, TEAM_PRESET_LABELS, TEAM_SECTION_LABELS, TEAM_SECTION_ORDER,
  resolveVisibleSections, type TeamView, type TeamPreset, type TeamSectionKey,
} from '@/lib/reports/teamReportView'

interface MetricStat {
  test_name: string; key: string; label: string; unit?: string
  bilateral: boolean; percentil: boolean; n: number
  mean: number | null; min: number | null; max: number | null
  mean_izq: number | null; mean_der: number | null
  outliers: { nombre: string; detalle: string }[]
}
interface PlayerFlag { nombre?: string; motivo?: string }
interface WorkGroup { nombre?: string; foco?: string; jugadores?: string[] }
type RiskLevel = 'rojo' | 'ambar' | 'verde'
interface PlayerRisk { nombre: string; maxAsim: number | null; worstPct: number | null; lesiones: number; nivel: RiskLevel; motivos: string[] }
interface AnexoRow { nombre: string; nivel: RiskLevel; metricaClave: string | null; titular?: string | null }
interface Kpis { valorados: number; pctAsimetriaAlta: number | null; conLesion24m: number; aVigilar: number }
interface Injuries { jugadoresConLesion: number; totalLesiones: number; conCirugia: number; zonas: { zona: string; n: number }[] }

interface TeamRoundData {
  portada?: { equipo?: string; estudio?: string; grupo?: string; ronda?: number; cobertura?: string }
  kpis?: Kpis
  semaforo?: PlayerRisk[]
  resumen_equipo?: string
  panel_metricas?: MetricStat[]
  lesiones?: Injuries
  patrones_y_riesgos?: string
  fortalezas?: string
  grupos_de_trabajo?: WorkGroup[]
  jugadores_a_vigilar?: PlayerFlag[]
  recomendaciones?: string
  anexo?: AnexoRow[]
  descargo?: string
  _view?: TeamView
  _meta?: Record<string, any>
}

interface Props { reportId: string; initialStatus: string; initialData: TeamRoundData }

const LEVEL_STYLE: Record<string, string> = {
  rojo: 'bg-red-50 text-red-700',
  ambar: 'bg-amber-50 text-amber-700',
  verde: 'bg-green-50 text-green-700',
  sin_datos: 'bg-gray-100 text-gray-500',
}
const LEVEL_DOT: Record<string, string> = { rojo: 'bg-red-500', ambar: 'bg-amber-500', verde: 'bg-green-500', sin_datos: 'bg-gray-400' }
// Un jugador sin asimetría ni percentil medidos no es "sin riesgo": es "sin datos VALD".
const effLevel = (r: { maxAsim?: number | null; worstPct?: number | null; nivel: string }) =>
  r.maxAsim == null && r.worstPct == null ? 'sin_datos' : r.nivel

export default function CampaignReportView({ reportId, initialStatus, initialData }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TeamRoundData>(initialData)
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showToggles, setShowToggles] = useState(false)
  const approved = status === 'approved'

  const view = data._view || { preset: 'completo' as TeamPreset }
  const visible = resolveVisibleSections(view)
  function setPreset(preset: TeamPreset) { setData((prev) => ({ ...prev, _view: { preset, overrides: {} } })) }
  function toggleSection(k: TeamSectionKey) {
    setData((prev) => {
      const v = prev._view || { preset: 'completo' as TeamPreset }
      const cur = resolveVisibleSections(v)
      return { ...prev, _view: { preset: v.preset, overrides: { ...(v.overrides || {}), [k]: !cur[k] } } }
    })
  }

  function setText(key: keyof TeamRoundData, value: string) { setData((prev) => ({ ...prev, [key]: value })) }

  const players = data.jugadores_a_vigilar || []
  function updatePlayer(i: number, patch: Partial<PlayerFlag>) {
    setData((prev) => { const arr = [...(prev.jugadores_a_vigilar || [])]; arr[i] = { ...arr[i], ...patch }; return { ...prev, jugadores_a_vigilar: arr } })
  }
  function addPlayer() { setData((prev) => ({ ...prev, jugadores_a_vigilar: [...(prev.jugadores_a_vigilar || []), { nombre: '', motivo: '' }] })) }
  function removePlayer(i: number) { setData((prev) => ({ ...prev, jugadores_a_vigilar: (prev.jugadores_a_vigilar || []).filter((_, idx) => idx !== i) })) }

  const grupos = data.grupos_de_trabajo || []
  function updateGroup(i: number, patch: Partial<WorkGroup>) {
    setData((prev) => { const arr = [...(prev.grupos_de_trabajo || [])]; arr[i] = { ...arr[i], ...patch }; return { ...prev, grupos_de_trabajo: arr } })
  }
  function addGroup() { setData((prev) => ({ ...prev, grupos_de_trabajo: [...(prev.grupos_de_trabajo || []), { nombre: '', foco: '', jugadores: [] }] })) }
  function removeGroup(i: number) { setData((prev) => ({ ...prev, grupos_de_trabajo: (prev.grupos_de_trabajo || []).filter((_, idx) => idx !== i) })) }

  async function persist(newStatus?: string) {
    const body: Record<string, any> = { report_data: data }
    if (newStatus) body.status = newStatus
    const res = await fetch(`/api/reports/${reportId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar')
  }
  async function handleSave() { setSaving(true); try { await persist(); toast.success('Cambios guardados'); router.refresh() } catch (e: any) { toast.error(e.message) } setSaving(false) }
  async function handleApprove() { setApproving(true); try { await persist('approved'); setStatus('approved'); toast.success('Informe aprobado'); router.refresh() } catch (e: any) { toast.error(e.message) } setApproving(false) }
  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/reports/export-pdf-campaign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Error al exportar')
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Informe_Equipo_${(data._meta?.equipo || 'equipo').replace(/\s+/g, '_')}.pdf`; a.click(); URL.revokeObjectURL(url)
    } catch (e: any) { toast.error(e.message) }
    setDownloading(false)
  }

  const p = data.portada || {}
  const panel = data.panel_metricas || []
  const byTest = panel.reduce<Record<string, MetricStat[]>>((acc, s) => { (acc[s.test_name] ||= []).push(s); return acc }, {})
  const semaforo = data.semaforo || []
  const kpis = data.kpis
  const les = data.lesiones
  const anexo = data.anexo || []
  // Aviso de calidad de datos (solo en la vista; NO se exporta al PDF).
  const alerts = detectDataAlerts((data as any).rendimiento, semaforo)

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-10">
        <span className="inline-flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{approved ? 'Aprobado' : 'Borrador'}</span>
          {formatDuration((data as any)?._generation_ms) && <span className="text-xs text-gray-400">Generado en {formatDuration((data as any)._generation_ms)}</span>}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg disabled:opacity-50">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar</button>
          <button onClick={handleApprove} disabled={approving || approved} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">{approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Aprobar</button>
          <button onClick={handleDownload} disabled={downloading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-xs font-medium rounded-lg disabled:opacity-50">{downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF</button>
        </div>
      </div>

      {/* Preset + toggles de secciones */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Vista:</span>
          {(Object.keys(TEAM_PRESETS) as TeamPreset[]).map((pr) => (
            <button key={pr} onClick={() => setPreset(pr)} disabled={approved}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${view.preset === pr ? 'bg-clinical-primary text-white border-clinical-primary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {TEAM_PRESET_LABELS[pr]}
            </button>
          ))}
          <button onClick={() => setShowToggles((s) => !s)} className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Secciones
          </button>
        </div>
        {showToggles && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {TEAM_SECTION_ORDER.map((k) => (
              <label key={k} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" checked={visible[k]} onChange={() => toggleSection(k)} disabled={approved} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                {TEAM_SECTION_LABELS[k]}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Aviso de calidad de datos (solo aquí; NO sale en el PDF) */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800">Revisa estos datos antes de aprobar</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Valores atípicos que pueden ser un error de lectura del PDF de VALD. Compruébalos en el informe individual del jugador (el dato objetivo es editable). <strong>Este aviso no aparece en el PDF exportado.</strong>
              </p>
              <ul className="mt-2 space-y-1">
                {alerts.map((a, i) => (
                  <li key={i} className="text-xs text-amber-900">
                    <strong>{a.nombre}</strong> · {a.metrica}: <span className="font-mono">{a.valor}{a.unidad}</span> <span className="text-amber-600">({a.motivo})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Cabecera del equipo/ronda */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="text-gray-800"><span className="text-gray-400">Equipo:</span> <strong>{p.equipo || '—'}</strong></span>
          <span className="text-gray-800"><span className="text-gray-400">Estudio:</span> {p.estudio || '—'}</span>
          <span className="text-gray-800"><span className="text-gray-400">Ronda:</span> {p.ronda ?? '—'}</span>
          <span className="text-gray-800"><span className="text-gray-400">Cobertura:</span> {p.cobertura || '—'}</span>
        </div>
      </div>

      {/* KPIs (calculado) */}
      {visible.kpis && kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { n: kpis.valorados, t: 'valorados' },
            { n: kpis.pctAsimetriaAlta != null ? `${kpis.pctAsimetriaAlta}%` : '—', t: 'con asimetría >15%' },
            { n: kpis.conLesion24m, t: 'con lesión (24 m)' },
            { n: kpis.aVigilar, t: 'a vigilar' },
          ].map((k, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4"><div className="text-2xl font-semibold text-gray-900">{k.n}</div><div className="text-xs text-gray-500 mt-1">{k.t}</div></div>
          ))}
        </div>
      )}

      {/* Semáforo (calculado) */}
      {visible.semaforo && semaforo.length > 0 && (
        <Section label="Semáforo de jugadores" note="calculado · por riesgo (asimetría · percentil · lesiones)">
          <div className="flex flex-wrap gap-2">
            {semaforo.map((r, i) => {
              const lv = effLevel(r)
              return (
                <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${LEVEL_STYLE[lv]}`} title={(r.motivos || []).join(' · ') || 'sin datos VALD'}>
                  <span className={`w-2 h-2 rounded-full ${LEVEL_DOT[lv]}`} />{r.nombre}{r.maxAsim != null ? <span className="font-mono">· {Math.round(r.maxAsim)}%</span> : lv === 'sin_datos' ? <span className="text-[10px]">· s/d</span> : null}
                </span>
              )
            })}
          </div>
        </Section>
      )}

      {/* Gráficos (calculado) */}
      {visible.graficos && (
        <Section label="Gráficos" note="calculado">
          <TeamCharts semaforo={semaforo as any} panel={panel as any} lesiones={data.lesiones as any} rendimiento={(data as any).rendimiento} />
        </Section>
      )}

      {/* Resumen (IA, editable) */}
      {visible.resumen_equipo && (
        <Section label="Resumen del equipo">
          <textarea value={data.resumen_equipo || ''} onChange={(e) => setText('resumen_equipo', e.target.value)} rows={4} disabled={approved} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50" />
        </Section>
      )}

      {/* Panel (calculado) */}
      {visible.panel_metricas && (
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-gray-400" /><h2 className="text-sm font-semibold text-gray-900">Panel de métricas del equipo</h2><span className="text-[11px] text-gray-400">(calculado · solo lectura)</span></div>
          {panel.length === 0 ? (
            <p className="text-xs text-gray-400">Sin métricas objetivas.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(byTest).map(([testName, stats]) => (
                <div key={testName} className="border border-gray-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">{testName}</p>
                  <div className="space-y-1">
                    {stats.map((s) => (
                      <div key={s.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-gray-600 w-40">{s.label}{s.unit ? ` (${s.unit})` : ''}</span>
                        <span className="text-gray-800 font-mono">{s.bilateral ? `izq ${s.mean_izq ?? '—'} / der ${s.mean_der ?? '—'}` : `media ${s.mean ?? '—'}${s.min != null ? ` · rango ${s.min}–${s.max}` : ''}`}</span>
                        <span className="text-gray-400">n={s.n}</span>
                        {s.outliers.length > 0 && <span className="text-amber-700">a vigilar: {s.outliers.map((o) => `${o.nombre} (${o.detalle})`).join(', ')}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Lesiones (calculado) */}
      {visible.lesiones && les && (
        <Section label="Radiografía de lesiones (24 meses)" note="calculado">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div><span className="text-xl font-semibold text-gray-900">{les.jugadoresConLesion}</span> <span className="text-xs text-gray-500">jugadores</span></div>
            <div><span className="text-xl font-semibold text-gray-900">{les.totalLesiones}</span> <span className="text-xs text-gray-500">lesiones</span></div>
            <div><span className="text-xl font-semibold text-gray-900">{les.conCirugia}</span> <span className="text-xs text-gray-500">con cirugía</span></div>
            <div className="flex flex-wrap gap-1.5">{(les.zonas || []).slice(0, 6).map((z, i) => <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700">{z.zona} <span className="font-mono">{z.n}</span></span>)}</div>
          </div>
        </Section>
      )}

      {/* Patrones + Fortalezas (IA) */}
      {visible.patrones_y_riesgos && (
        <Section label="Patrones y riesgos"><textarea value={data.patrones_y_riesgos || ''} onChange={(e) => setText('patrones_y_riesgos', e.target.value)} rows={4} disabled={approved} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50" /></Section>
      )}
      {visible.fortalezas && (
        <Section label="Fortalezas del colectivo"><textarea value={data.fortalezas || ''} onChange={(e) => setText('fortalezas', e.target.value)} rows={4} disabled={approved} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50" /></Section>
      )}

      {/* Grupos de trabajo (IA, editable) */}
      {visible.grupos_de_trabajo && (
        <Section label="Grupos de trabajo">
          <div className="space-y-3">
            {grupos.map((g, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <input value={g.nombre || ''} onChange={(e) => updateGroup(i, { nombre: e.target.value })} placeholder="Nombre del grupo" disabled={approved} className="flex-1 text-sm font-medium border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                  {!approved && <button onClick={() => removeGroup(i)} className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <input value={g.foco || ''} onChange={(e) => updateGroup(i, { foco: e.target.value })} placeholder="Foco / objetivo" disabled={approved} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                <input value={(g.jugadores || []).join(', ')} onChange={(e) => updateGroup(i, { jugadores: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Jugadores (separados por comas)" disabled={approved} className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
              </div>
            ))}
            {!approved && <button onClick={addGroup} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mt-1"><Plus className="w-3.5 h-3.5" /> Añadir grupo</button>}
          </div>
        </Section>
      )}

      {/* Jugadores a vigilar (IA, editable) */}
      {visible.jugadores_a_vigilar && (
        <Section label="Jugadores a vigilar">
          <div className="space-y-2">
            {players.map((pl, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <input value={pl.nombre || ''} onChange={(e) => updatePlayer(i, { nombre: e.target.value })} placeholder="Nombre" disabled={approved} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                <input value={pl.motivo || ''} onChange={(e) => updatePlayer(i, { motivo: e.target.value })} placeholder="Motivo" disabled={approved} className="flex-[2] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                {!approved && <button onClick={() => removePlayer(i)} className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
            {!approved && <button onClick={addPlayer} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mt-1"><Plus className="w-3.5 h-3.5" /> Añadir jugador</button>}
          </div>
        </Section>
      )}

      {/* Recomendaciones (IA) */}
      {visible.recomendaciones && (
        <Section label="Recomendaciones"><textarea value={data.recomendaciones || ''} onChange={(e) => setText('recomendaciones', e.target.value)} rows={4} disabled={approved} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50" /></Section>
      )}

      {/* Anexo por jugador (calculado) */}
      {visible.anexo && anexo.length > 0 && (
        <Section label="Anexo por jugador" note="calculado · titular del informe individual">
          <div className="divide-y divide-gray-50">
            {anexo.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${LEVEL_DOT[r.metricaClave == null ? 'sin_datos' : r.nivel]}`} />
                <div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-900 truncate">{r.nombre}</div>{r.titular && <div className="text-xs text-gray-500 truncate">{r.titular}</div>}</div>
                {r.metricaClave && <span className="text-xs font-mono text-gray-600 flex-shrink-0">{r.metricaClave}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Descargo (siempre) */}
      <Section label="Descargo de responsabilidad">
        <textarea value={data.descargo || ''} onChange={(e) => setText('descargo', e.target.value)} rows={5} disabled={approved} className="w-full text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50" />
      </Section>

      <p className="text-[11px] text-gray-400 flex items-center gap-1.5 px-1">
        Los datos numéricos provienen de VALD, extraídos automáticamente del PDF y pendientes de validación.
      </p>
    </div>
  )
}

function Section({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2"><h2 className="text-sm font-semibold text-gray-900">{label}</h2>{note && <span className="text-[11px] text-gray-400">{note}</span>}</div>
      {children}
    </section>
  )
}
