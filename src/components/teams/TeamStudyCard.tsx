'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Sparkles, Shield, CheckCircle2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

export interface RoundPlayer {
  id: string
  full_name: string
  status: 'approved' | 'draft' | 'none' // estado del informe individual de esa ronda
}
interface Props {
  campaignId: string
  team: { id: string; name: string }
  rounds: number[]
  playersByRound: Record<number, RoundPlayer[]>
  reportsByRound: Record<number, { id: string; status: string; created_at: string } | undefined>
}

export default function TeamStudyCard({ campaignId, team, rounds, playersByRound, reportsByRound }: Props) {
  const router = useRouter()
  const hasRounds = rounds.length > 0
  const [round, setRound] = useState<number>(hasRounds ? rounds[rounds.length - 1] : 1)
  const players = useMemo(() => playersByRound[round] || [], [playersByRound, round])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  // Al cambiar de ronda: excluir por defecto a quien no esté APROBADO.
  useEffect(() => {
    setExcluded(new Set(players.filter((p) => p.status !== 'approved').map((p) => p.id)))
  }, [players])

  function toggle(id: string) {
    setExcluded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const included = players.filter((p) => !excluded.has(p.id))
  const includedNotApproved = included.filter((p) => p.status !== 'approved')
  const canGenerate = hasRounds && included.length > 0 && includedNotApproved.length === 0

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/reports/campaign-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, teamId: team.id, round, excluded: Array.from(excluded) }),
      })
      if (res.status === 409) {
        toast('Ya se está generando el informe de este equipo/ronda.')
        router.push(`/estudios/${campaignId}/report?team=${team.id}&round=${round}`)
        return
      }
      if (!res.ok && res.status !== 202) throw new Error((await res.json()).error || 'Error al generar')
      // 202: se genera en segundo plano. La página de revisión mostrará el panel de "Generando…".
      toast.success('Generando en segundo plano; puedes cerrar la página.')
      router.push(`/estudios/${campaignId}/report?team=${team.id}&round=${round}`)
    } catch (e: any) {
      toast.error(e.message || 'Error al generar el informe')
      setGenerating(false)
    }
  }

  const statusChip = (s: RoundPlayer['status']) =>
    s === 'approved' ? <span className="text-[11px] text-green-600">✅ Aprobado</span>
      : s === 'draft' ? <span className="text-[11px] text-amber-600">📝 Pendiente</span>
        : <span className="text-[11px] text-gray-400">— Sin valorar</span>

  const existing = reportsByRound[round]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900 truncate">{team.name}</h3>
        </div>
        {rounds.length > 1 && (
          <select value={round} onChange={(e) => setRound(Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
            {rounds.map((r) => <option key={r} value={r}>Ronda {r}</option>)}
          </select>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {!hasRounds ? (
          <p className="text-sm text-gray-500">Este equipo aún no tiene valoraciones en el estudio.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">
                Ronda {round} · <strong className="text-gray-700">{included.filter((p) => p.status === 'approved').length}/{included.length}</strong> incluidos aprobados
              </p>
              {existing && (
                <Link href={`/estudios/${campaignId}/report?team=${team.id}&round=${round}`} className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                  <FileText className="w-3 h-3" /> {existing.status === 'approved' ? 'Aprobado' : 'Borrador'} · {new Date(existing.created_at).toLocaleDateString('es-ES')}
                </Link>
              )}
            </div>

            <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl mb-3">
              {players.map((p) => (
                <label key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer">
                  <span className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" checked={!excluded.has(p.id)} onChange={() => toggle(p.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    <Link href={`/patients/${p.id}/report`} onClick={(e) => e.stopPropagation()} className="text-sm text-gray-800 hover:text-blue-600 truncate">{p.full_name}</Link>
                  </span>
                  {statusChip(p.status)}
                </label>
              ))}
            </div>

            {includedNotApproved.length > 0 && (
              <p className="text-[11px] text-amber-700 mb-2">
                Hay {includedNotApproved.length} jugador(es) incluidos sin aprobar. Apruébalos o desmárcalos para poder generar.
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={generate}
                disabled={!canGenerate || generating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando…</> : <><Sparkles className="w-4 h-4" /> {existing ? 'Regenerar' : 'Generar'} informe · Ronda {round}</>}
              </button>
              {existing && (
                <Link href={`/estudios/${campaignId}/report?team=${team.id}&round=${round}`} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Revisar
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
