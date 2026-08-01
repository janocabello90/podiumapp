import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Users } from 'lucide-react'
import { computeStage } from '@/lib/clinical/stage'
import { getRegionLabel, getPathologyLabel } from '@/lib/clinical/taxonomy'
import SportSelect from '@/components/sports/SportSelect'
import BulkImportPlayers from '@/components/teams/BulkImportPlayers'
import { normalize } from '@/lib/patients/rosterImport'

export const dynamic = 'force-dynamic'

export default async function TeamRosterPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return <div>Perfil no encontrado</div>
  const isAdmin = profile.role === 'admin'

  // Equipo + su grupo (defensa en profundidad: filtro clinic_id además de RLS)
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, category, group_id, sport_id, groups(name)')
    .eq('id', params.id)
    .eq('clinic_id', profile.clinic_id)
    .single()

  if (!team) notFound()

  // Deportes activos de la clínica (para el selector de deporte del equipo)
  const { data: sports } = await supabase
    .from('sports')
    .select('id, name')
    .eq('clinic_id', profile.clinic_id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Roster: jugadores del equipo (con relaciones para computeStage)
  const { data: rawPlayers } = await supabase
    .from('patients')
    .select(`
      id, full_name, email, body_region, pathology_tag, pathology_label,
      anamnesis_forms(id, status, created_at, expires_at),
      assessments(id, status, created_at),
      sessions(id, status, created_at),
      documents(id, doc_type, created_at),
      reports(id, status, created_at)
    `)
    .eq('team_id', team.id)
    .eq('clinic_id', profile.clinic_id)
    .eq('status', 'active')
    .order('full_name', { ascending: true })

  const players = rawPlayers || []
  const groupName = (team.groups as any)?.name as string | undefined
  const existingEmails = players
    .map((p: any) => (p.email ? normalize(p.email) : ''))
    .filter(Boolean)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href={`/groups/${team.group_id}`}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
              {team.name}
              {team.category && (
                <span className="ml-2 text-sm text-gray-400 font-normal">{team.category}</span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {[groupName, `${players.length} jugador${players.length !== 1 ? 'es' : ''}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && <BulkImportPlayers teamId={team.id} clinicId={profile.clinic_id} existingEmails={existingEmails} />}
          <Link
            href={`/patients/new?team_id=${team.id}`}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Añadir jugador</span>
            <span className="sm:hidden">Añadir</span>
          </Link>
        </div>
      </div>

      {/* Deporte del equipo — asignarlo es estructura (solo admin). El fisio lo ve como texto. */}
      {(sports || []).length > 0 && (
        isAdmin ? (
          <div className="mb-4 sm:mb-6 bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 flex items-center justify-between gap-3">
            <SportSelect
              table="teams"
              rowId={team.id}
              currentSportId={(team as any).sport_id ?? null}
              sports={sports || []}
              label="Deporte del equipo:"
            />
          </div>
        ) : (team as any).sport_id ? (
          <div className="mb-4 sm:mb-6 bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Deporte del equipo:</span>
            <span className="font-medium text-gray-900">{(sports || []).find((s: any) => s.id === (team as any).sport_id)?.name || '—'}</span>
          </div>
        ) : null
      )}

      {/* Roster */}
      {players.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 sm:px-6 py-10 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500 mb-3">Este equipo aún no tiene jugadores.</p>
          <Link
            href={`/patients/new?team_id=${team.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-xs font-medium rounded-lg transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Añadir jugador
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {players.map((p: any) => {
              const stage = computeStage(p)
              const Icon = stage.icon
              const clinicalLine = [
                getRegionLabel(p.body_region),
                p.pathology_label || getPathologyLabel(p.pathology_tag),
              ].filter(Boolean).join(' · ')

              return (
                <li key={p.id}>
                  <Link
                    href={`/patients/${p.id}?ctx=equipo`}
                    className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-blue-700">
                          {p.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.full_name}</p>
                        {clinicalLine && (
                          <p className="text-xs text-gray-500 truncate">{clinicalLine}</p>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${stage.bg} ${stage.text} flex-shrink-0 ml-2`}>
                      <Icon className="w-3 h-3" />
                      <span className="hidden sm:inline">{stage.shortLabel}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
