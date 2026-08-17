import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CampaignReportView from '@/components/report/CampaignReportView'
import GeneratingPanel from '@/components/report/GeneratingPanel'
import { isGenerationStale } from '@/lib/reports/background'

export const dynamic = 'force-dynamic'

export default async function CampaignReportPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { team?: string; round?: string }
}) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>
  const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
  if (!profile) return <div>Perfil no encontrado</div>

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('id', params.id)
    .eq('clinic_id', profile.clinic_id)
    .single()
  if (!campaign) notFound()

  const teamId = searchParams.team || null
  const round = searchParams.round ? Number(searchParams.round) : null

  // Último informe de equipo para (estudio, equipo, ronda).
  let query = supabase
    .from('reports')
    .select('id, status, report_data, team_id, campaign_round, created_at')
    .eq('campaign_id', campaign.id)
    .eq('scope', 'campaign')
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })
    .limit(1)
  if (teamId) query = query.eq('team_id', teamId)
  if (round != null) query = query.eq('campaign_round', round)
  const { data: report } = await query.maybeSingle()

  const rd = (report?.report_data as any) || {}
  const equipo = rd?.portada?.equipo || rd?._meta?.equipo || 'Equipo'
  const ronda = rd?.portada?.ronda ?? rd?._meta?.ronda
  // 'generating' atascado → error (evita panel infinito / bucle de refresco).
  const genStale = report?.status === 'generating' && isGenerationStale((report as any).created_at)
  const effStatus = genStale ? 'error' : report?.status
  const genErrorMsg = genStale ? 'La generación tardó demasiado. Reinténtalo.' : rd?._error

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <Link href={`/estudios/${campaign.id}`} className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Informe de equipo</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {campaign.name}{report ? ` · ${equipo}${ronda != null ? ` · Ronda ${ronda}` : ''}` : ''}
          </p>
        </div>
      </div>

      {!report ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-10 text-center">
          <p className="text-sm text-gray-500">
            No hay informe para este equipo/ronda todavía. Genéralo desde{' '}
            <Link href={`/estudios/${campaign.id}`} className="text-blue-600 hover:underline">la página del estudio</Link>.
          </p>
        </div>
      ) : effStatus === 'generating' ? (
        <GeneratingPanel reportId={report.id} />
      ) : effStatus === 'error' ? (
        <div className="bg-white rounded-2xl border border-red-200 px-4 py-10 text-center">
          <p className="text-sm text-gray-700">Falló la generación{genErrorMsg ? `: ${genErrorMsg}` : ''}.</p>
          <p className="text-xs text-gray-400 mt-2">
            Vuelve a <Link href={`/estudios/${campaign.id}`} className="text-blue-600 hover:underline">la página del estudio</Link> para regenerarlo.
          </p>
        </div>
      ) : (
        <CampaignReportView
          reportId={report.id}
          initialStatus={report.status || 'draft'}
          initialData={rd}
        />
      )}
    </div>
  )
}
