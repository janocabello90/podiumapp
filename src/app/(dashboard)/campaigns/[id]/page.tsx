import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield, Check, FileText } from 'lucide-react'
import StartSessionButton from '@/components/sessions/StartSessionButton'
import CloseCampaignButton from '@/components/teams/CloseCampaignButton'
import CampaignReportButton from '@/components/teams/CampaignReportButton'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>
  const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
  if (!profile) return <div>Perfil no encontrado</div>

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

  // Jugadores de esos equipos + sesiones de esta campaña
  let players: any[] = []
  const sessionsByPatient = new Map<string, number>()
  if (teamIds.length > 0) {
    const [{ data: pl }, { data: sess }] = await Promise.all([
      supabase.from('patients').select('id, full_name, team_id').in('team_id', teamIds).eq('status', 'active').order('full_name'),
      supabase.from('sessions').select('id, patient_id').eq('campaign_id', campaign.id).eq('clinic_id', profile.clinic_id),
    ])
    players = pl || []
    for (const s of sess || []) sessionsByPatient.set(s.patient_id, (sessionsByPatient.get(s.patient_id) || 0) + 1)
  }

  const valued = players.filter((p) => (sessionsByPatient.get(p.id) || 0) > 0).length
  const groupName = (campaign.groups as any)?.name as string | undefined

  // Último informe de campaña (si existe).
  const { data: latestReport } = await supabase
    .from('reports')
    .select('id, status, created_at')
    .eq('campaign_id', campaign.id)
    .eq('scope', 'campaign')
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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
              {[groupName, campaign.status === 'closed' ? 'Cerrada' : 'Activa'].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <CloseCampaignButton campaignId={campaign.id} status={campaign.status || 'active'} />
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
          <p className="text-gray-800 font-medium">{valued} / {players.length} valorados</p>
        </div>
      </div>

      {/* Informe de campaña */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" /> Informe de campaña
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Informe agregado por IA de las valoraciones de la campaña (cualitativo). Revisable y exportable a PDF.
            {latestReport && (
              <>
                {' · '}
                <Link href={`/campaigns/${campaign.id}/report`} className="text-blue-600 hover:underline">
                  Ver último ({latestReport.status === 'approved' ? 'aprobado' : 'borrador'})
                </Link>
              </>
            )}
          </p>
        </div>
        <CampaignReportButton campaignId={campaign.id} valued={valued} total={players.length} />
      </div>

      {/* Roster por equipo */}
      {teams.length === 0 ? (
        <p className="text-sm text-gray-400">Esta campaña no tiene equipos.</p>
      ) : (
        <div className="space-y-6">
          {teams.map((team) => {
            const teamPlayers = players.filter((p) => p.team_id === team.id)
            return (
              <div key={team.id}>
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-blue-500" /> {team.name}
                </h2>
                {teamPlayers.length === 0 ? (
                  <p className="text-xs text-gray-400 bg-white rounded-2xl border border-gray-200 px-4 py-4">Sin jugadores.</p>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                    {teamPlayers.map((p) => {
                      const count = sessionsByPatient.get(p.id) || 0
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Link href={`/patients/${p.id}`} className="text-sm font-medium text-gray-900 truncate hover:text-blue-700">{p.full_name}</Link>
                            {count > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <Check className="w-3.5 h-3.5" /> {count} sesión{count !== 1 ? 'es' : ''}
                              </span>
                            )}
                          </div>
                          <StartSessionButton patientId={p.id} campaignId={campaign.id} label={count > 0 ? 'Seguimiento' : 'Valorar'} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
