import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ConsentsManager from '@/components/settings/ConsentsManager'

export const dynamic = 'force-dynamic'

export default async function ConsentsSettingsPage() {
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

  const { data: versions } = await supabase
    .from('consent_versions')
    .select('*')
    .eq('clinic_id', profile.clinic_id)
    .eq('is_active', true)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Consentimientos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Textos que el paciente acepta en la anamnesis</p>
        </div>
      </div>

      <ConsentsManager clinicId={profile.clinic_id} initialVersions={versions || []} />
    </div>
  )
}
