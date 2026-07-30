'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, CheckCircle2, FileDown, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface TeamFinding {
  equipo?: string
  resumen?: string
  hallazgos?: string[]
}
interface PlayerFlag {
  nombre?: string
  equipo?: string
  motivo?: string
}
interface CampaignReportData {
  portada_intro?: string
  resumen_campana?: string
  hallazgos_por_equipo?: TeamFinding[]
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
  initialData: CampaignReportData
}

const TEXT_SECTIONS: { key: keyof CampaignReportData; label: string; small?: boolean }[] = [
  { key: 'portada_intro', label: 'Introducción' },
  { key: 'resumen_campana', label: 'Resumen del estudio' },
  { key: 'patrones_y_riesgos', label: 'Patrones y riesgos' },
  { key: 'fortalezas', label: 'Fortalezas' },
  { key: 'recomendaciones', label: 'Recomendaciones' },
  { key: 'descargo', label: 'Descargo de responsabilidad', small: true },
]

export default function CampaignReportView({ reportId, initialStatus, initialData }: Props) {
  const router = useRouter()
  const [data, setData] = useState<CampaignReportData>(initialData)
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [downloading, setDownloading] = useState(false)

  function setText(key: keyof CampaignReportData, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  // --- Hallazgos por equipo ---
  const teams = data.hallazgos_por_equipo || []
  function updateTeam(i: number, patch: Partial<TeamFinding>) {
    setData((prev) => {
      const arr = [...(prev.hallazgos_por_equipo || [])]
      arr[i] = { ...arr[i], ...patch }
      return { ...prev, hallazgos_por_equipo: arr }
    })
  }

  // --- Jugadores a vigilar ---
  const players = data.jugadores_a_vigilar || []
  function updatePlayer(i: number, patch: Partial<PlayerFlag>) {
    setData((prev) => {
      const arr = [...(prev.jugadores_a_vigilar || [])]
      arr[i] = { ...arr[i], ...patch }
      return { ...prev, jugadores_a_vigilar: arr }
    })
  }
  function addPlayer() {
    setData((prev) => ({ ...prev, jugadores_a_vigilar: [...(prev.jugadores_a_vigilar || []), { nombre: '', equipo: '', motivo: '' }] }))
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
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error al guardar')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await persist()
      toast.success('Cambios guardados')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function handleApprove() {
    setApproving(true)
    try {
      await persist('approved')
      setStatus('approved')
      toast.success('Informe aprobado')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    }
    setApproving(false)
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/reports/export-pdf-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al exportar')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Informe_Estudio_${(data._meta?.campaign_name || 'estudio').replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err.message)
    }
    setDownloading(false)
  }

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-10">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {status === 'approved' ? 'Aprobado' : 'Borrador'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
          </button>
          <button onClick={handleApprove} disabled={approving || status === 'approved'} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
            {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Aprobar
          </button>
          <button onClick={handleDownload} disabled={downloading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-xs font-medium rounded-lg disabled:opacity-50">
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF
          </button>
        </div>
      </div>

      {/* Introducción + Resumen */}
      {TEXT_SECTIONS.slice(0, 2).map((s) => (
        <Section key={s.key} label={s.label}>
          <textarea value={(data[s.key] as string) || ''} onChange={(e) => setText(s.key, e.target.value)} rows={4}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
        </Section>
      ))}

      {/* Hallazgos por equipo */}
      <Section label="Hallazgos por equipo">
        {teams.length === 0 ? (
          <p className="text-xs text-gray-400">Sin desglose por equipo.</p>
        ) : (
          <div className="space-y-4">
            {teams.map((t, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <input value={t.equipo || ''} onChange={(e) => updateTeam(i, { equipo: e.target.value })}
                  className="w-full text-sm font-semibold border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Equipo" />
                <textarea value={t.resumen || ''} onChange={(e) => updateTeam(i, { resumen: e.target.value })} rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" placeholder="Resumen del equipo" />
                <textarea value={(t.hallazgos || []).join('\n')} onChange={(e) => updateTeam(i, { hallazgos: e.target.value.split('\n').filter((l) => l.trim()) })} rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" placeholder="Un hallazgo por línea" />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Patrones y riesgos + Fortalezas */}
      {TEXT_SECTIONS.slice(2, 4).map((s) => (
        <Section key={s.key} label={s.label}>
          <textarea value={(data[s.key] as string) || ''} onChange={(e) => setText(s.key, e.target.value)} rows={4}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
        </Section>
      ))}

      {/* Jugadores a vigilar */}
      <Section label="Jugadores a vigilar">
        <div className="space-y-2">
          {players.map((p, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input value={p.nombre || ''} onChange={(e) => updatePlayer(i, { nombre: e.target.value })} placeholder="Nombre"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={p.equipo || ''} onChange={(e) => updatePlayer(i, { equipo: e.target.value })} placeholder="Equipo"
                className="sm:w-40 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={p.motivo || ''} onChange={(e) => updatePlayer(i, { motivo: e.target.value })} placeholder="Motivo"
                className="flex-[2] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => removePlayer(i)} className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={addPlayer} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mt-1">
            <Plus className="w-3.5 h-3.5" /> Añadir jugador
          </button>
        </div>
      </Section>

      {/* Recomendaciones + Descargo */}
      {TEXT_SECTIONS.slice(4).map((s) => (
        <Section key={s.key} label={s.label}>
          <textarea value={(data[s.key] as string) || ''} onChange={(e) => setText(s.key, e.target.value)} rows={s.small ? 5 : 4}
            className={`w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y ${s.small ? 'text-xs text-gray-500' : 'text-sm'}`} />
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
