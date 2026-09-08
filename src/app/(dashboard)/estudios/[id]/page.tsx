import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CloseCampaignButton from '@/components/teams/CloseCampaignButton'
import EstudioTabs from '@/components/teams/EstudioTabs'
import { type RoundPlayer } from '@/components/teams/TeamStudyCard'
import { parseMetricsSchema } from '@/lib/reports/metrics'

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

  // Estado del informe INDIVIDUAL por sesión. Precedencia: aprobado > borrador > error.
  // (Si una sesión solo tiene informes en error, se marca 'error' para avisar en la UI.)
  const statusBySession = new Map<string, 'approved' | 'draft' | 'error'>()
  const sessionIds = sessions.map((s) => s.id)
  if (sessionIds.length > 0) {
    // Estado = el del informe MÁS RECIENTE de la sesión (no el "mejor"): si se regenera un
    // aprobado, el nuevo borrador manda hasta que se vuelva a aprobar.
    const { data: ind } = await supabase
      .from('reports')
      .select('session_id, status, created_at')
      .eq('scope', 'individual')
      .eq('clinic_id', profile.clinic_id)
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
    for (const r of ind || []) {
      if (statusBySession.has(r.session_id)) continue // ya tenemos el más reciente de esta sesión
      const cur: 'approved' | 'draft' | 'error' =
        r.status === 'approved' || r.status === 'delivered' ? 'approved'
          : r.status === 'error' ? 'error' : 'draft'
      statusBySession.set(r.session_id, cur)
    }
  }

  // ¿Le faltan DATOS OBJETIVOS (VALD) a la sesión? Un informe de equipo sin métricas de VALD
  // no está completo (p. ej. recuperados sin regenerar) → se marca para regenerar.
  // "Falta" = la sesión TIENE pruebas con métricas definidas pero NINGUNA tiene valores.
  const missingMetricsBySession = new Map<string, boolean>()
  if (sessionIds.length > 0) {
    const { data: sts } = await supabase
      .from('session_tests')
      .select('session_id, result_data, tests(result_schema)')
      .in('session_id', sessionIds)
    const bySession = new Map<string, { expects: boolean; has: boolean }>()
    for (const st of sts || []) {
      const cur = bySession.get(st.session_id) || { expects: false, has: false }
      if (parseMetricsSchema((st as any).tests?.result_schema).length > 0) cur.expects = true
      const rd = (st as any).result_data
      if (rd && typeof rd === 'object' && Object.keys(rd).some((k) => k !== '_meta')) cur.has = true
      bySession.set(st.session_id, cur)
    }
    bySession.forEach((v, sid) => missingMetricsBySession.set(sid, v.expects && !v.has))
  }

  // Informes de EQUIPO existentes (scope=campaign), por (team, round).
  const { data: teamReports } = await supabase
    .from('reports')
    .select('id, team_id, campaign_round, status, created_at')
    .eq('scope', 'campaign')
    .eq('campaign_id', campaign.id)
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })

  // Estado de las rondas por equipo (campaign_team_rounds): abierta/cerrada + lista de rondas
  // (incluye rondas recién abiertas que aún no tienen sesiones).
  const { data: teamRounds } = await supabase
    .from('campaign_team_rounds')
    .select('team_id, round_number, status')
    .eq('campaign_id', campaign.id)
    .eq('clinic_id', profile.clinic_id)
  const roundStatusByKey = new Map<string, 'open' | 'closed'>() // `${team_id}_${round}` → status
  const roundsByTeam = new Map<string, number[]>()
  for (const r of teamRounds || []) {
    roundStatusByKey.set(`${r.team_id}_${r.round_number}`, (r.status as 'open' | 'closed'))
    const arr = roundsByTeam.get(r.team_id) || []
    arr.push(r.round_number)
    roundsByTeam.set(r.team_id, arr)
  }

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
    // Incluir también las rondas declaradas (campaign_team_rounds), aunque aún no tengan sesiones
    // (p. ej. una ronda recién abierta lista para valorar).
    for (const r of roundsByTeam.get(team.id) || []) roundsSet.add(r)
    const rounds = Array.from(roundsSet).sort((a, b) => a - b)
    // Estado (abierta/cerrada) por ronda. Por defecto 'open' si no hubiera fila (defensivo).
    const roundStatusByRound: Record<number, 'open' | 'closed'> = {}
    for (const r of rounds) roundStatusByRound[r] = roundStatusByKey.get(`${team.id}_${r}`) || 'open'
    const playersByRound: Record<number, RoundPlayer[]> = {}
    for (const r of rounds) {
      playersByRound[r] = teamPlayers.map((p) => {
        const sid = sessionByPatientRound.get(`${p.id}_${r}`)
        const status: RoundPlayer['status'] = !sid ? 'none' : (statusBySession.get(sid) || 'draft')
        const missingMetrics = sid ? (missingMetricsBySession.get(sid) ?? false) : false
        return { id: p.id, full_name: p.full_name, status, sessionId: sid || null, missingMetrics }
      })
    }
    const reportsByRound: Record<number, { id: string; status: string; created_at: string } | undefined> = {}
    for (const r of rounds) {
      const rep = (teamReports || []).find((x: any) => x.team_id === team.id && x.campaign_round === r)
      if (rep) reportsByRound[r] = { id: rep.id, status: rep.status || 'draft', created_at: rep.created_at as string }
    }
    return { team, rounds, playersByRound, reportsByRound, roundStatusByRound }
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

      {/* Contenido en pestañas: Jugadores (roster + anamnesis) · Informes (por ronda) */}
      {teams.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 p-4">Este estudio no tiene equipos.</p>
      ) : (
        <EstudioTabs
          campaignId={campaign.id}
          teamCards={teamCards}
          rosterTeams={teams}
          rosterPlayers={players.map((p) => ({
            id: p.id,
            full_name: p.full_name,
            team_id: p.team_id,
            email: p.email ?? null,
            anamnesisCompleted: anamnesisByPatient.get(p.id) === 'completed',
            sessionCount: sessionsByPatient.get(p.id) || 0,
          }))}
        />
      )}
    </div>
  )
}
