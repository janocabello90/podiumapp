import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, ChevronRight, FolderKanban } from 'lucide-react'
import CreateGroupForm from '@/components/teams/CreateGroupForm'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return <div>Perfil no encontrado</div>
  const isAdmin = profile.role === 'admin'

  // Grupos de la clínica + nº de equipos (defensa en profundidad: filtro clinic_id además de RLS)
  const { data: rawGroups } = await supabase
    .from('groups')
    .select('id, name, notes, created_at, teams(count)')
    .eq('clinic_id', profile.clinic_id)
    .order('name', { ascending: true })

  const groups = (rawGroups || []).map((g: any) => ({
    ...g,
    teamCount: g.teams?.[0]?.count ?? 0,
  }))

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Equipos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {groups.length} grupo{groups.length !== 1 ? 's' : ''} · gestiona grupos y sus equipos
        </p>
      </div>

      {/* Crear grupo (solo admin) */}
      {isAdmin && (
        <div className="mb-4 sm:mb-6">
          <CreateGroupForm clinicId={profile.clinic_id} />
        </div>
      )}

      {/* Lista de grupos */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 sm:px-6 py-10 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500">{isAdmin ? 'Aún no hay grupos. Crea el primero arriba.' : 'Aún no hay grupos.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {groups.map((g: any) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FolderKanban className="w-4 h-4 text-blue-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {g.teamCount} equipo{g.teamCount !== 1 ? 's' : ''}
                      </p>
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
