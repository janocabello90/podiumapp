'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Check, ChevronRight, Mail, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Player = {
  id: string
  full_name: string
  team_id: string
  email: string | null
  anamnesisCompleted: boolean
  sessionCount: number
}
type Team = { id: string; name: string }

export default function StudyRoster({ teams, players }: { teams: Team[]; players: Player[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  const allIds = players.map((p) => p.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function setMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })
  }

  async function sendBulk() {
    const patientIds = Array.from(selected)
    if (patientIds.length === 0) return
    setSending(true)
    try {
      const res = await fetch('/api/anamnesis/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar')
      const s = data.summary || {}
      const parts = [
        s.sent ? `${s.sent} enviada(s)` : null,
        s.completed ? `${s.completed} ya completada(s)` : null,
        s.no_email ? `${s.no_email} sin email` : null,
        s.error ? `${s.error} con error` : null,
      ].filter(Boolean)
      toast.success(`Anamnesis: ${parts.join(' · ') || 'sin cambios'}`)
      setSelected(new Set())
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'No se pudo enviar')
    } finally {
      setSending(false)
    }
  }

  if (teams.length === 0) return <p className="text-sm text-gray-400">Este estudio no tiene equipos.</p>

  return (
    <div className="space-y-4">
      {/* Barra de selección / envío */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-gray-200 px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => setMany(allIds, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Seleccionar todo el grupo
          {selected.size > 0 && <span className="text-xs text-gray-400">· {selected.size} seleccionado(s)</span>}
        </label>
        <button
          onClick={sendBulk}
          disabled={sending || selected.size === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Enviar anamnesis por correo{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
      </div>

      {teams.map((team) => {
        const teamPlayers = players.filter((p) => p.team_id === team.id)
        const teamIds = teamPlayers.map((p) => p.id)
        const teamAllSelected = teamIds.length > 0 && teamIds.every((id) => selected.has(id))
        return (
          <div key={team.id}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" /> {team.name}
              </h2>
              {teamPlayers.length > 0 && (
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={teamAllSelected}
                    onChange={(e) => setMany(teamIds, e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Todo el equipo
                </label>
              )}
            </div>
            {teamPlayers.length === 0 ? (
              <p className="text-xs text-gray-400 bg-white rounded-2xl border border-gray-200 px-4 py-4">Sin jugadores.</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                {teamPlayers.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                    />
                    <Link href={`/patients/${p.id}?ctx=equipo`} className="flex items-center justify-between gap-2 min-w-0 flex-1 group">
                      <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">{p.full_name}</span>
                        {p.sessionCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 flex-shrink-0"><Check className="w-3.5 h-3.5" /> {p.sessionCount} sesión{p.sessionCount !== 1 ? 'es' : ''}</span>
                        ) : (
                          <span className="text-xs text-gray-400 flex-shrink-0">Sin valorar</span>
                        )}
                        {!p.anamnesisCompleted && (
                          <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">Anamnesis pendiente</span>
                        )}
                        {!p.email && (
                          <span className="text-[11px] text-gray-400 flex-shrink-0" title="No se puede enviar por correo: sin email">sin email</span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
