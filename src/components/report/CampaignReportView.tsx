'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, CheckCircle2, FileDown, Plus, Trash2, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'

interface MetricStat {
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
}
interface PlayerFlag { nombre?: string; motivo?: string }
interface TeamRoundData {
  portada?: { equipo?: string; estudio?: string; grupo?: string; ronda?: number; cobertura?: string }
  resumen_equipo?: string
  panel_metricas?: MetricStat[]
  patrones_y_riesgos?: string
  fortalezas?: string
  jugadores_a_vigilar?: PlayerFlag[]
  recomendaciones?: string
  descargo?: string
  _meta?: Record<string, any>
}

interface Props {
  reportId: string
  initialStatus: string
  initialData: TeamRoundData
}

const TEXT_SECTIONS: { key: keyof TeamRoundData; label: string; small?: boolean }[] = [
  { key: 'resumen_equipo', label: 'Resumen del equipo' },
  { key: 'patrones_y_riesgos', label: 'Patrones y riesgos' },
  { key: 'fortalezas', label: 'Fortalezas del colectivo' },
  { key: 'recomendaciones', label: 'Recomendaciones' },
  { key: 'descargo', label: 'Descargo de responsabilidad', small: true },
]

export default function CampaignReportView({ reportId, initialStatus, initialData }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TeamRoundData>(initialData)
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const approved = status === 'approved'

  function setText(key: keyof TeamRoundData, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  const players = data.jugadores_a_vigilar || []
  function updatePlayer(i: number, patch: Partial<PlayerFlag>) {
    setData((prev) => {
      const arr = [...(prev.jugadores_a_vigilar || [])]
      arr[i] = { ...arr[i], ...patch }
      return { ...prev, jugadores_a_vigilar: arr }
    })
  }
  function addPlayer() {
    setData((prev) => ({ ...prev, jugadores_a_vigilar: [...(prev.jugadores_a_vigilar || []), { nombre: '', motivo: '' }] }))
  }
  function removePlayer(i: number) {
    setData((prev) => ({ ...prev, jugadores_a_vigilar: (prev.jugadores_a_vigilar || []).filter((_, idx) => idx !== i) }))
  }

  async function persist(newStatus?: string) {
    const body: Record<string, any> = { report_data: data }
    if (newStatus) body.status = newStatus
    const res = await fetch(`/api/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar')
  }

  async function handleSave() {
    setSaving(true)
    try { await persist(); toast.success('Cambios guardados'); router.refresh() } catch (e: any) { toast.error(e.message) }
    setSaving(false)
  }
  async function handleApprove() {
    setApproving(true)
    try { await persist('approved'); setStatus('approved'); toast.success('Informe aprobado'); router.refresh() } catch (e: any) { toast.error(e.message) }
    setApproving(false)
  }
  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/reports/export-pdf-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Informe_Equipo_${(data._meta?.equipo || 'equipo').replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { toast.error(e.message) }
    setDownloading(false)
  }

  const p = data.portada || {}
  const panel = data.panel_metricas || []
  // Agrupar el panel por prueba para pintarlo.
  const byTest = panel.reduce<Record<string, MetricStat[]>>((acc, s) => {
    (acc[s.test_name] ||= []).push(s); return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-10">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {approved ? 'Aprobado' : 'Borrador'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
          </button>
          <button onClick={handleApprove} disabled={approving || approved} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
            {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Aprobar
          </button>
          <button onClick={handleDownload} disabled={downloading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-xs font-medium rounded-lg disabled:opacity-50">
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF
          </button>
        </div>
      </div>

      {/* Cabecera del equipo/ronda */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="text-gray-800"><span className="text-gray-400">Equipo:</span> <strong>{p.equipo || '—'}</strong></span>
          <span className="text-gray-800"><span className="text-gray-400">Estudio:</span> {p.estudio || '—'}</span>
          <span className="text-gray-800"><span className="text-gray-400">Ronda:</span> {p.ronda ?? '—'}</span>
          <span className="text-gray-800"><span className="text-gray-400">Cobertura:</span> {p.cobertura || '—'}</span>
        </div>
      </div>

      {/* Resumen del equipo */}
      <Section label={TEXT_SECTIONS[0].label}>
        <textarea value={(data.resumen_equipo as string) || ''} onChange={(e) => setText('resumen_equipo', e.target.value)} rows={4} disabled={approved}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50" />
      </Section>

      {/* Panel de métricas (calculado, solo lectura) */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Panel de métricas del equipo</h2>
          <span className="text-[11px] text-gray-400">(calculado · solo lectura)</span>
        </div>
        {panel.length === 0 ? (
          <p className="text-xs text-gray-400">Sin métricas objetivas (define las métricas clave por prueba en Ajustes → Deportes y pruebas).</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(byTest).map(([testName, stats]) => (
              <div key={testName} className="border border-gray-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-700 mb-1.5">{testName}</p>
                <div className="space-y-1">
                  {stats.map((s) => (
                    <div key={s.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                      <span className="text-gray-600 w-40">{s.label}{s.unit ? ` (${s.unit})` : ''}</span>
                      <span className="text-gray-800 font-mono">
                        {s.bilateral
                          ? `izq ${s.mean_izq ?? '—'} / der ${s.mean_der ?? '—'}`
                          : `media ${s.mean ?? '—'}${s.min != null ? ` · rango ${s.min}–${s.max}` : ''}`}
                      </span>
                      <span className="text-gray-400">n={s.n}</span>
                      {s.outliers.length > 0 && (
                        <span className="text-amber-700">a vigilar: {s.outliers.map((o) => `${o.nombre} (${o.detalle})`).join(', ')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Patrones y riesgos + Fortalezas */}
      {TEXT_SECTIONS.slice(1, 3).map((s) => (
        <Section key={s.key} label={s.label}>
          <textarea value={(data[s.key] as string) || ''} onChange={(e) => setText(s.key, e.target.value)} rows={4} disabled={approved}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50" />
        </Section>
      ))}

      {/* Jugadores a vigilar */}
      <Section label="Jugadores a vigilar">
        <div className="space-y-2">
          {players.map((pl, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input value={pl.nombre || ''} onChange={(e) => updatePlayer(i, { nombre: e.target.value })} placeholder="Nombre" disabled={approved}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
              <input value={pl.motivo || ''} onChange={(e) => updatePlayer(i, { motivo: e.target.value })} placeholder="Motivo" disabled={approved}
                className="flex-[2] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
              {!approved && <button onClick={() => removePlayer(i)} className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
          {!approved && (
            <button onClick={addPlayer} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mt-1">
              <Plus className="w-3.5 h-3.5" /> Añadir jugador
            </button>
          )}
        </div>
      </Section>

      {/* Recomendaciones + Descargo */}
      {TEXT_SECTIONS.slice(3).map((s) => (
        <Section key={s.key} label={s.label}>
          <textarea value={(data[s.key] as string) || ''} onChange={(e) => setText(s.key, e.target.value)} rows={s.small ? 5 : 4} disabled={approved}
            className={`w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50 ${s.small ? 'text-xs text-gray-500' : 'text-sm'}`} />
        </Section>
      ))}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">{label}</h2>
      {children}
    </section>
  )
}
