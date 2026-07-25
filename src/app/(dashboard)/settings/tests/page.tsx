import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TestsManager from '@/components/settings/TestsManager'

export const dynamic = 'force-dynamic'

export default async function TestsSettingsPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (!profile) return <div>Perfil no encontrado</div>

  const { data: tests } = await supabase
    .from('tests')
    .select('*')
    .eq('clinic_id', profile.clinic_id)
    .order('name', { ascending: true })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Catálogo de pruebas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pruebas disponibles y su prompt de interpretación VALD</p>
        </div>
      </div>

      <TestsManager clinicId={profile.clinic_id} initialTests={tests || []} />
    </div>
  )
}
