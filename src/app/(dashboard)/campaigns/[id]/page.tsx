import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield, Check, Sparkles, AlertTriangle } from 'lucide-react'
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

  // Jugadores de esos equipos + sesiones de este estudio
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

  // Último informe de estudio (si existe).
  const { data: latestReport } = await supabase
    .from('reports')
    .select('id, status, created_at, report_data')
    .eq('campaign_id', campaign.id)
    .eq('scope', 'campaign')
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const rd = (latestReport?.report_data as any) || null
  const resumen: string | null = rd?.resumen_campana || rd?.portada_intro || null
  const resumenSnippet = resumen ? (resumen.length > 260 ? resumen.slice(0, 260).trimEnd() + '…' : resumen) : null
  const vigilar: any[] = Array.isArray(rd?.jugadores_a_vigilar) ? rd.jugadores_a_vigilar : []

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
          <p className="text-gray-800 font-medium"><span className="font-mono">{valued} / {players.length}</span> valorados</p>
        </div>
      </div>

      {/* Informe de estudio (IA) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-clinical-navy to-clinical-primary px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4" />
            <h2 className="text-sm font-semibold">Informe de estudio (IA)</h2>
          </div>
          {latestReport && (
            <span className="text-[11px] text-white/80 font-mono">
              {latestReport.status === 'approved' ? 'Aprobado' : 'Borrador'} · {new Date(latestReport.created_at as string).toLocaleDateString('es-ES')}
            </span>
          )}
        </div>
        <div className="p-4 sm:p-5">
          {latestReport ? (
            <>
              {resumenSnippet ? (
                <p className="text-sm text-gray-600 leading-relaxed">{resumenSnippet}</p>
              ) : (
                <p className="text-sm text-gray-500">Informe generado. Ábrelo para revisarlo.</p>
              )}
              {vigilar.length > 0 && (
                <div className="mt-3 flex items-start gap-2 bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span><strong>{vigilar.length}</strong> jugador{vigilar.length !== 1 ? 'es' : ''} a vigilar{vigilar[0]?.nombre ? `: ${vigilar.slice(0, 3).map((v: any) => v.nombre).filter(Boolean).join(', ')}${vigilar.length > 3 ? '…' : ''}` : ''}</span>
                </div>
              )}
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <Link href={`/campaigns/${campaign.id}/report`} className="inline-flex items-center gap-1.5 px-4 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-xs font-semibold rounded-lg transition-colors">
                  Revisar informe
                </Link>
                <span className="text-xs text-gray-400 font-mono">Cobertura {valued}/{players.length}</span>
                <span className="ml-auto"><CampaignReportButton campaignId={campaign.id} valued={valued} total={players.length} /></span>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">Aún no se ha generado. Agrega las valoraciones del estudio en un informe cualitativo: estado del colectivo, hallazgos por equipo y jugadores a vigilar. Revisable y exportable a PDF.</p>
              <div className="mt-3"><CampaignReportButton campaignId={campaign.id} valued={valued} total={players.length} /></div>
            </>
          )}
        </div>
      </div>

      {/* Roster por equipo */}
      {teams.length === 0 ? (
        <p className="text-sm text-gray-400">Este estudio no tiene equipos.</p>
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
