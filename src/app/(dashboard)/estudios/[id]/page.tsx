import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import CloseCampaignButton from '@/components/teams/CloseCampaignButton'
import StudyRoster from '@/components/teams/StudyRoster'
import TeamStudyCard, { type RoundPlayer } from '@/components/teams/TeamStudyCard'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>
  const { data: profile } = await supabase.from('users').select('clinic_id, role').eq('id', user.id).single()
  if (!profile) return <div>Perfil no encontrado</div>
  const isAdmin = profile.role === 'admin'

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, status, start_date, end_date_planned, planned_consultations, group_id, groups(name)')
    .eq('id', params.id)
    .eq('clinic_id', profile.clinic_id)
    .single()
  if (!campaign) notFound()

  // Equipos incluidos
  const { data: cts } = await supabase
    .from('campaign_teams')
    .select('team_id, teams(id, name)')
    .eq('campaign_id', campaign.id)
    .eq('clinic_id', profile.clinic_id)
  const teams = (cts || []).map((ct: any) => ({ id: ct.team_id, name: ct.teams?.name ?? 'Equipo' }))
  const teamIds = teams.map((t) => t.id)

  // Jugadores de esos equipos + sesiones de este estudio (con ronda)
  let players: any[] = []
  let sessions: any[] = []
  const sessionsByPatient = new Map<string, number>()
  if (teamIds.length > 0) {
    const [{ data: pl }, { data: sess }] = await Promise.all([
      supabase.from('patients').select('id, full_name, team_id, email').in('team_id', teamIds).eq('status', 'active').order('full_name'),
      supabase.from('sessions').select('id, patient_id, campaign_round').eq('campaign_id', campaign.id).eq('clinic_id', profile.clinic_id),
    ])
    players = pl || []
    sessions = sess || []
    for (const s of sessions) sessionsByPatient.set(s.patient_id, (sessionsByPatient.get(s.patient_id) || 0) + 1)
  }

  // Estado del informe INDIVIDUAL por sesión (aprobado prevalece).
  const statusBySession = new Map<string, 'approved' | 'draft'>()
  const sessionIds = sessions.map((s) => s.id)
  if (sessionIds.length > 0) {
    const { data: ind } = await supabase
      .from('reports')
      .select('session_id, status')
      .eq('scope', 'individual')
      .eq('clinic_id', profile.clinic_id)
      .in('session_id', sessionIds)
    for (const r of ind || []) {
      const prev = statusBySession.get(r.session_id)
      if (r.status === 'approved' || !prev) statusBySession.set(r.session_id, r.status === 'approved' ? 'approved' : 'draft')
    }
  }

  // Informes de EQUIPO existentes (scope=campaign), por (team, round).
  const { data: teamReports } = await supabase
    .from('reports')
    .select('id, team_id, campaign_round, status, created_at')
    .eq('scope', 'campaign')
    .eq('campaign_id', campaign.id)
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })

  // Índice sesión por (patient, round)
  const sessionByPatientRound = new Map<string, string>()
  for (const s of sessions) if (s.campaign_round != null) sessionByPatientRound.set(`${s.patient_id}_${s.campaign_round}`, s.id)

  // Anamnesis por jugador (para StudyRoster)
  const anamnesisByPatient = new Map<string, string>()
  if (players.length > 0) {
    const { data: anam } = await supabase
      .from('anamnesis_forms')
      .select('patient_id, status, created_at')
      .in('patient_id', players.map((p) => p.id))
      .eq('clinic_id', profile.clinic_id)
      .order('created_at', { ascending: false })
    for (const a of anam || []) if (!anamnesisByPatient.has(a.patient_id)) anamnesisByPatient.set(a.patient_id, a.status || 'pending')
  }

  const groupName = (campaign.groups as any)?.name as string | undefined
  const valued = players.filter((p) => (sessionsByPatient.get(p.id) || 0) > 0).length

  // Datos por equipo para las tarjetas de informe
  const teamCards = teams.map((team) => {
    const teamPlayers = players.filter((p) => p.team_id === team.id)
    const roundsSet = new Set<number>()
    for (const p of teamPlayers) {
      for (const s of sessions) {
        if (s.patient_id === p.id && s.campaign_round != null) roundsSet.add(s.campaign_round)
      }
    }
    const rounds = Array.from(roundsSet).sort((a, b) => a - b)
    const playersByRound: Record<number, RoundPlayer[]> = {}
    for (const r of rounds) {
      playersByRound[r] = teamPlayers.map((p) => {
        const sid = sessionByPatientRound.get(`${p.id}_${r}`)
        const status: RoundPlayer['status'] = !sid ? 'none' : (statusBySession.get(sid) === 'approved' ? 'approved' : 'draft')
        return { id: p.id, full_name: p.full_name, status }
      })
    }
    const reportsByRound: Record<number, { id: string; status: string; created_at: string } | undefined> = {}
    for (const r of rounds) {
      const rep = (teamReports || []).find((x: any) => x.team_id === team.id && x.campaign_round === r)
      if (rep) reportsByRound[r] = { id: rep.id, status: rep.status || 'draft', created_at: rep.created_at as string }
    }
    return { team, rounds, playersByRound, reportsByRound }
  })

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href={`/groups/${campaign.group_id}`} className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{campaign.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {[groupName, campaign.status === 'closed' ? 'Cerrado' : 'Activo'].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {isAdmin && <CloseCampaignButton campaignId={campaign.id} status={campaign.status || 'active'} />}
      </div>

      {/* Info + progreso */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400">Inicio</p>
          <p className="text-gray-800">{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('es-ES') : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Fin previsto</p>
          <p className="text-gray-800">{campaign.end_date_planned ? new Date(campaign.end_date_planned).toLocaleDateString('es-ES') : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Seguimientos</p>
          <p className="text-gray-800">{campaign.planned_consultations ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Progreso</p>
          <p className="text-gray-800 font-medium"><span className="font-mono">{valued} / {players.length}</span> valorados</p>
        </div>
      </div>

      {/* Informes por equipo (IA) */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-clinical-primary" />
          <h2 className="text-sm font-semibold text-gray-900">Informes de equipo (IA)</h2>
          <span className="text-[11px] text-gray-400">un informe por equipo y ronda · requiere los individuales aprobados</span>
        </div>
        {teamCards.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 p-4">Este estudio no tiene equipos.</p>
        ) : (
          <div className="space-y-4">
            {teamCards.map((c) => (
              <TeamStudyCard
                key={c.team.id}
                campaignId={campaign.id}
                team={c.team}
                rounds={c.rounds}
                playersByRound={c.playersByRound}
                reportsByRound={c.reportsByRound}
              />
            ))}
          </div>
        )}
      </div>

      {/* Roster por equipo con envío masivo de anamnesis */}
      <StudyRoster
        teams={teams}
        players={players.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          team_id: p.team_id,
          email: p.email ?? null,
          anamnesisCompleted: anamnesisByPatient.get(p.id) === 'completed',
          sessionCount: sessionsByPatient.get(p.id) || 0,
        }))}
      />
    </div>
  )
}
