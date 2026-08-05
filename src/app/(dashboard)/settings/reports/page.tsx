import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ReportPromptsEditor from '@/components/settings/ReportPromptsEditor'
import { REPORT_TYPES, DEFAULT_REPORT_INSTRUCTIONS, type ReportPromptType } from '@/lib/reports/prompt'

export const dynamic = 'force-dynamic'

export default async function ReportsSettingsPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return <div>Perfil no encontrado</div>
  if (profile.role !== 'admin') redirect('/dashboard')

  const { data: rows } = await supabase
    .from('report_prompts')
    .select('type, instructions')
    .eq('clinic_id', profile.clinic_id)

  const byType = new Map((rows || []).map((r: any) => [r.type, r.instructions]))
  const initial: Record<ReportPromptType, string> = {
    individual: '', team: '', campaign: '',
  }
  for (const t of REPORT_TYPES) {
    const custom = (byType.get(t) || '').trim()
    initial[t] = custom || DEFAULT_REPORT_INSTRUCTIONS[t]
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Informes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personaliza el rol y las indicaciones de la IA para cada tipo de informe. La estructura de secciones es fija.</p>
        </div>
      </div>

      <ReportPromptsEditor clinicId={profile.clinic_id} initial={initial} />
    </div>
  )
}
