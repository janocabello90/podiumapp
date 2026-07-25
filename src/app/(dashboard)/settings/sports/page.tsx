import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Dumbbell } from 'lucide-react'
import CreateSportForm from '@/components/settings/CreateSportForm'

export const dynamic = 'force-dynamic'

export default async function SportsSettingsPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (!profile) return <div>Perfil no encontrado</div>

  const { data: rawSports } = await supabase
    .from('sports')
    .select('id, name, description, is_active, sport_tests(count)')
    .eq('clinic_id', profile.clinic_id)
    .order('name', { ascending: true })

  const sports = (rawSports || []).map((s: any) => ({ ...s, testCount: s.sport_tests?.[0]?.count ?? 0 }))

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Deportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Deportes y las pruebas que les corresponden</p>
        </div>
      </div>

      <div className="mb-4 sm:mb-6">
        <CreateSportForm clinicId={profile.clinic_id} />
      </div>

      {sports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-2">
            <Dumbbell className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500">Aún no hay deportes. Crea el primero arriba.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {sports.map((s: any) => (
              <li key={s.id}>
                <Link href={`/settings/sports/${s.id}`} className="flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Dumbbell className="w-4 h-4 text-blue-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {s.name}
                        {!s.is_active && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Inactivo</span>}
                      </p>
                      <p className="text-xs text-gray-500">{s.testCount} prueba{s.testCount !== 1 ? 's' : ''} mapeada{s.testCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
