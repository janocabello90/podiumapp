'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import PatientList from './PatientList'
import TeamAnamnesisActions from './TeamAnamnesisActions'

const PAGE = 15

type Group = { id: string; name: string; list: any[] }

export default function PatientsBrowser({
  teamGroups,
  individualPatients,
  clinicId,
}: {
  teamGroups: Group[]
  individualPatients: any[]
  clinicId?: string
}) {
  const teamTotal = teamGroups.reduce((n, g) => n + g.list.length, 0)
  const [tab, setTab] = useState<'equipo' | 'individual'>(teamGroups.length > 0 ? 'equipo' : 'individual')
  const [teamId, setTeamId] = useState(teamGroups[0]?.id || '')
  const [pageInd, setPageInd] = useState(0)
  const [pageTeam, setPageTeam] = useState(0)

  const activeTeam = teamGroups.find((g) => g.id === teamId) || teamGroups[0]

  return (
    <div>
      {/* Tabs */}
      <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1 mb-4">
        <button
          onClick={() => setTab('equipo')}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'equipo' ? 'bg-white text-clinical-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          En equipo <span className="tabular-nums opacity-70">({teamTotal})</span>
        </button>
        <button
          onClick={() => setTab('individual')}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'individual' ? 'bg-white text-clinical-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Individuales <span className="tabular-nums opacity-70">({individualPatients.length})</span>
        </button>
      </div>

      {tab === 'equipo' ? (
        teamGroups.length === 0 || !activeTeam ? (
          <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-200 px-4 py-8 text-center">No hay pacientes en equipo.</p>
        ) : (
          <div>
            {/* Selector de equipo */}
            {teamGroups.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {teamGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setTeamId(g.id); setPageTeam(0) }}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${g.id === activeTeam.id ? 'bg-clinical-soft border-clinical-primary/30 text-clinical-navy font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {g.name} <span className="text-gray-400 tabular-nums">· {g.list.length}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Cabecera del equipo activo + acción común */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <Link href={`/teams/${activeTeam.id}`} className="hover:text-blue-700">{activeTeam.name}</Link>
                <span className="text-xs text-gray-400 font-normal tabular-nums">· {activeTeam.list.length}</span>
              </h3>
              {clinicId && (
                <TeamAnamnesisActions
                  clinicId={clinicId}
                  players={activeTeam.list.map((p) => ({ id: p.id, hasAnamnesis: (p.anamnesis_forms || []).length > 0 }))}
                />
              )}
            </div>

            <PatientList patients={activeTeam.list.slice(pageTeam * PAGE, (pageTeam + 1) * PAGE)} linkCtx="equipo" />
            <Pager total={activeTeam.list.length} page={pageTeam} setPage={setPageTeam} />
          </div>
        )
      ) : individualPatients.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-200 px-4 py-8 text-center">No hay pacientes individuales.</p>
      ) : (
        <div>
          <PatientList patients={individualPatients.slice(pageInd * PAGE, (pageInd + 1) * PAGE)} />
          <Pager total={individualPatients.length} page={pageInd} setPage={setPageInd} />
        </div>
      )}
    </div>
  )
}

function Pager({ total, page, setPage }: { total: number; page: number; setPage: (n: number) => void }) {
  const pages = Math.ceil(total / PAGE)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      <button
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        <ChevronLeft className="w-4 h-4" /> Anterior
      </button>
      <span className="text-xs text-gray-500 tabular-nums">Página {page + 1} de {pages}</span>
      <button
        disabled={page >= pages - 1}
        onClick={() => setPage(page + 1)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        Siguiente <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
