import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Megaphone, ChevronRight } from 'lucide-react'
import CreateStudyForm from '@/components/teams/CreateStudyForm'

export const dynamic = 'force-dynamic'

export default async function EstudiosPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>
  const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
  if (!profile) return <div>Perfil no encontrado</div>
  const cid = profile.clinic_id

  // Grupos + equipos (para crear estudios eligiendo grupo/equipos aquí mismo)
  const { data: rawGroups } = await supabase
    .from('groups')
    .select('id, name, teams(id, name)')
    .eq('clinic_id', cid)
    .order('name', { ascending: true })
  const groupsForForm = (rawGroups || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    teams: (g.teams || []).map((t: any) => ({ id: t.id, name: t.name })),
  }))

  // Estudios de la clínica
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, start_date, end_date_planned, group_id, groups(name)')
    .eq('clinic_id', cid)
    .order('created_at', { ascending: false })

  const campaignList = campaigns || []
  const campaignIds = campaignList.map((c) => c.id)

  // Equipos por estudio
  const { data: cts } = await supabase
    .from('campaign_teams')
    .select('campaign_id, team_id, teams(name)')
    .eq('clinic_id', cid)

  const teamsByCampaign = new Map<string, { id: string; name: string }[]>()
  const allTeamIds = new Set<string>()
  for (const ct of cts || []) {
    const arr = teamsByCampaign.get(ct.campaign_id) || []
    arr.push({ id: ct.team_id, name: (ct.teams as any)?.name ?? 'Equipo' })
    teamsByCampaign.set(ct.campaign_id, arr)
    allTeamIds.add(ct.team_id)
  }

  // Jugadores de esos equipos + sesiones de esas estudios (para progreso)
  const [{ data: players }, { data: sessions }] = await Promise.all([
    allTeamIds.size > 0
      ? supabase.from('patients').select('id, team_id').in('team_id', Array.from(allTeamIds)).eq('status', 'active').eq('clinic_id', cid)
      : Promise.resolve({ data: [] as any[] }),
    campaignIds.length > 0
      ? supabase.from('sessions').select('patient_id, campaign_id').in('campaign_id', campaignIds).eq('clinic_id', cid)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const playersByTeam = new Map<string, string[]>()
  for (const p of players || []) {
    const arr = playersByTeam.get(p.team_id) || []
    arr.push(p.id)
    playersByTeam.set(p.team_id, arr)
  }
  // patient_ids valorados por estudio
  const valuedByCampaign = new Map<string, Set<string>>()
  for (const s of sessions || []) {
    if (!s.campaign_id) continue
    const set = valuedByCampaign.get(s.campaign_id) || new Set<string>()
    set.add(s.patient_id)
    valuedByCampaign.set(s.campaign_id, set)
  }

  function progress(campaignId: string) {
    const teamIds = (teamsByCampaign.get(campaignId) || []).map((t) => t.id)
    const roster = new Set<string>()
    teamIds.forEach((tid) => (playersByTeam.get(tid) || []).forEach((pid) => roster.add(pid)))
    const valuedSet = valuedByCampaign.get(campaignId) || new Set<string>()
    let valued = 0
    roster.forEach((pid) => { if (valuedSet.has(pid)) valued++ })
    return { valued, total: roster.size }
  }

  const active = campaignList.filter((c) => c.status !== 'closed')
  const closed = campaignList.filter((c) => c.status === 'closed')

  function StudyCard({ c }: { c: any }) {
    const teams = teamsByCampaign.get(c.id) || []
    const { valued, total } = progress(c.id)
    const pct = total > 0 ? Math.round((valued / total) * 100) : 0
    const groupName = (c.groups as any)?.name as string | undefined
    return (
      <Link
        href={`/estudios/${c.id}`}
        className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 hover:border-blue-300 hover:shadow-sm transition-all"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{c.name}</p>
            {groupName && <p className="text-sm text-gray-500 mt-0.5">{groupName}</p>}
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${c.status === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'closed' ? 'bg-gray-400' : 'bg-blue-600'}`}></span>
            {c.status === 'closed' ? 'Cerrado' : 'Activo'}
          </span>
        </div>

        {teams.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {teams.map((t) => (
              <span key={t.id} className="text-xs px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-600">{t.name}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-clinical-navy" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-700 tabular-nums font-mono min-w-[52px] text-right">{valued}/{total}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 tabular-nums font-mono">
            {c.start_date ? new Date(c.start_date).toLocaleDateString('es-ES') : '—'}
            {c.end_date_planned ? ` → ${new Date(c.end_date_planned).toLocaleDateString('es-ES')}` : ''}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Estudios</h1>
        <p className="text-sm text-gray-500 mt-1">Estudios de valoración por grupo deportivo.</p>
      </div>

      {/* Crear estudio (elige grupo + equipos aquí mismo) */}
      <div className="mb-6 sm:mb-8">
        <CreateStudyForm clinicId={cid} groups={groupsForForm} />
      </div>

      {campaignList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 mb-3">
            <Megaphone className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500 mb-1">Aún no hay estudios.</p>
          <p className="text-xs text-gray-400">Crea el primero con «Nuevo estudio» eligiendo grupo y equipos.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Activos
              <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-md tabular-nums">{active.length}</span>
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-200 px-4 py-6 text-center">Sin estudios activos.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((c) => <StudyCard key={c.id} c={c} />)}
              </div>
            )}
          </section>

          {closed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                Finalizados
                <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-md tabular-nums">{closed.length}</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {closed.map((c) => <StudyCard key={c.id} c={c} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
