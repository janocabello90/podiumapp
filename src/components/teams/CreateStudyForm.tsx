'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Team = { id: string; name: string }
type Group = { id: string; name: string; teams: Team[] }

export default function CreateStudyForm({ clinicId, groups }: { clinicId: string; groups: Group[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [groupId, setGroupId] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [consultations, setConsultations] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const group = groups.find((g) => g.id === groupId)
  const teams = group?.teams || []

  function selectGroup(id: string) {
    setGroupId(id)
    setSelected(new Set())
  }
  function toggleTeam(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!groupId) return toast.error('Elige un grupo')
    if (!name.trim()) return toast.error('El nombre del estudio es obligatorio')
    if (selected.size === 0) return toast.error('Selecciona al menos un equipo')
    setLoading(true)
    try {
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert({
          clinic_id: clinicId,
          group_id: groupId,
          name: name.trim(),
          start_date: startDate || null,
          end_date_planned: endDate || null,
          planned_consultations: consultations ? Number(consultations) : null,
        })
        .select('id')
        .single()
      if (error) throw error

      const rows = Array.from(selected).map((teamId) => ({
        clinic_id: clinicId,
        campaign_id: (campaign as any).id,
        team_id: teamId,
      }))
      const { error: ctErr } = await supabase.from('campaign_teams').insert(rows)
      if (ctErr) throw ctErr

      toast.success('Estudio creado')
      router.push(`/estudios/${(campaign as any).id}`)
    } catch (err: any) {
      toast.error(err.message || 'Error al crear el estudio')
      setLoading(false)
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Crea antes un grupo y sus equipos en{' '}
        <a href="/groups" className="text-clinical-primary hover:underline">Grupos</a>{' '}para poder abrir un estudio.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" /> Nuevo estudio
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Grupo</label>
          <select
            value={groupId}
            onChange={(e) => selectGroup(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="">Elige un grupo…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nombre del estudio</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Pretemporada 2026"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {groupId && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Equipos incluidos</p>
          {teams.length === 0 ? (
            <p className="text-xs text-gray-400">Este grupo no tiene equipos. Añádelos en su página de grupo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => (
                <label key={t.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleTeam(t.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  {t.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Inicio</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fin previsto (opcional)</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nº seguimientos</label>
          <input type="number" min={0} value={consultations} onChange={(e) => setConsultations(e.target.value)} placeholder="ej. 3" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 px-4 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear estudio
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-gray-500 text-sm hover:bg-gray-50 rounded-xl">Cancelar</button>
      </div>
    </form>
  )
}
