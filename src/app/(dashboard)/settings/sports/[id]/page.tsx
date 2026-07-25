import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SportTestsEditor from '@/components/settings/SportTestsEditor'

export const dynamic = 'force-dynamic'

export default async function SportDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (!profile) return <div>Perfil no encontrado</div>

  const { data: sport } = await supabase
    .from('sports')
    .select('id, name, description')
    .eq('id', params.id)
    .eq('clinic_id', profile.clinic_id)
    .single()

  if (!sport) notFound()

  // Catálogo de pruebas activas + mapeo actual del deporte
  const [{ data: tests }, { data: links }] = await Promise.all([
    supabase
      .from('tests')
      .select('id, name, description')
      .eq('clinic_id', profile.clinic_id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('sport_tests')
      .select('id, test_id, display_order, is_required')
      .eq('sport_id', sport.id)
      .eq('clinic_id', profile.clinic_id),
  ])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 min-w-0">
        <Link href="/settings/sports" className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{sport.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Marca las pruebas que corresponden a este deporte</p>
        </div>
      </div>

      <SportTestsEditor
        clinicId={profile.clinic_id}
        sportId={sport.id}
        tests={tests || []}
        initialLinks={links || []}
      />
    </div>
  )
}
