'use client'

import { useState, useMemo } from 'react'
import { Users, Sparkles } from 'lucide-react'
import StudyRoster from './StudyRoster'
import TeamStudyCard, { type RoundPlayer } from './TeamStudyCard'

export interface TeamCard {
  team: { id: string; name: string }
  rounds: number[]
  playersByRound: Record<number, RoundPlayer[]>
  reportsByRound: Record<number, { id: string; status: string; created_at: string } | undefined>
  roundStatusByRound: Record<number, 'open' | 'closed'>
}
type RosterTeam = { id: string; name: string }
type RosterPlayer = {
  id: string
  full_name: string
  team_id: string
  email: string | null
  anamnesisCompleted: boolean
  sessionCount: number
}

// Página del estudio en pestañas: "Jugadores" (roster + anamnesis) e "Informes"
// (organizados por RONDA; dentro de cada ronda, los informes individuales de cada equipo
// y el informe de equipo de esa ronda). Los KPIs de progreso van fuera, en el server.
export default function EstudioTabs({
  campaignId,
  teamCards,
  rosterTeams,
  rosterPlayers,
}: {
  campaignId: string
  teamCards: TeamCard[]
  rosterTeams: RosterTeam[]
  rosterPlayers: RosterPlayer[]
}) {
  const [tab, setTab] = useState<'jugadores' | 'informes'>('jugadores')

  // Todas las rondas del estudio (unión entre equipos), ordenadas.
  const allRounds = useMemo(() => {
    const s = new Set<number>()
    for (const tc of teamCards) for (const r of tc.rounds) s.add(r)
    return Array.from(s).sort((a, b) => a - b)
  }, [teamCards])

  // Ronda activa: la elegida si sigue existiendo; si no, la última.
  const [roundSel, setRoundSel] = useState<number | null>(null)
  const activeRound =
    roundSel != null && allRounds.includes(roundSel)
      ? roundSel
      : allRounds.length
        ? allRounds[allRounds.length - 1]
        : null

  const teamsInRound = activeRound == null ? [] : teamCards.filter((tc) => tc.rounds.includes(activeRound))

  const tabBtn = (id: 'jugadores' | 'informes', label: string, Icon: typeof Users) => (
    <button
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        tab === id
          ? 'border-clinical-primary text-clinical-primary'
          : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )

  return (
    <div>
      {/* Pestañas principales */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {tabBtn('jugadores', 'Jugadores', Users)}
        {tabBtn('informes', 'Informes', Sparkles)}
      </div>

      {tab === 'jugadores' ? (
        <StudyRoster teams={rosterTeams} players={rosterPlayers} />
      ) : (
        <div>
          <p className="text-[11px] text-gray-400 mb-3">
            Un informe por equipo y ronda · requiere los informes individuales aprobados.
          </p>

          {allRounds.length === 0 ? (
            <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 p-4">
              Aún no hay valoraciones en el estudio. Ve a <strong>Jugadores</strong> para enviar la anamnesis y valorar.
            </p>
          ) : (
            <>
              {/* Sub-pestañas por ronda (solo si hay más de una) */}
              {allRounds.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  {allRounds.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoundSel(r)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        r === activeRound
                          ? 'bg-clinical-primary text-white border-clinical-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Ronda {r}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {teamsInRound.map((tc) => (
                  <TeamStudyCard
                    key={`${tc.team.id}-${activeRound}`}
                    campaignId={campaignId}
                    team={tc.team}
                    rounds={[activeRound as number]}
                    playersByRound={tc.playersByRound}
                    reportsByRound={tc.reportsByRound}
                    roundStatus={tc.roundStatusByRound[activeRound as number] || 'open'}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
