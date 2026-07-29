import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CampaignReportView from '@/components/report/CampaignReportView'

export const dynamic = 'force-dynamic'

export default async function CampaignReportPage({ params }: { params: { id: string } }) {
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

  const { data: report } = await supabase
    .from('reports')
    .select('id, status, report_data')
    .eq('campaign_id', campaign.id)
    .eq('scope', 'campaign')
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <Link href={`/campaigns/${campaign.id}`} className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Informe de campaña</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{campaign.name}</p>
        </div>
      </div>

      {!report ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-10 text-center">
          <p className="text-sm text-gray-500">
            Esta campaña aún no tiene informe. Genéralo desde{' '}
            <Link href={`/campaigns/${campaign.id}`} className="text-blue-600 hover:underline">la página de la campaña</Link>.
          </p>
        </div>
      ) : (
        <CampaignReportView
          reportId={report.id}
          initialStatus={report.status || 'draft'}
          initialData={(report.report_data as any) || {}}
        />
      )}
    </div>
  )
}
