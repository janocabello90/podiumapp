import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, ChevronRight, Shield, Megaphone } from 'lucide-react'
import CreateTeamForm from '@/components/teams/CreateTeamForm'
import CreateCampaignForm from '@/components/teams/CreateCampaignForm'

export const dynamic = 'force-dynamic'

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (!profile) return <div>Perfil no encontrado</div>

  // Grupo (defensa en profundidad: filtro clinic_id además de RLS)
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, notes')
    .eq('id', params.id)
    .eq('clinic_id', profile.clinic_id)
    .single()

  if (!group) notFound()

  // Equipos del grupo + nº de jugadores
  const { data: rawTeams } = await supabase
    .from('teams')
    .select('id, name, category, created_at, patients(count)')
    .eq('group_id', group.id)
    .eq('clinic_id', profile.clinic_id)
    .order('name', { ascending: true })

  const teams = (rawTeams || []).map((t: any) => ({
    ...t,
    playerCount: t.patients?.[0]?.count ?? 0,
  }))

  // Estudios del grupo
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, start_date')
    .eq('group_id', group.id)
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 min-w-0">
        <Link href="/groups" className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{group.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {teams.length} equipo{teams.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Crear equipo */}
      <div className="mb-4 sm:mb-6">
        <CreateTeamForm clinicId={profile.clinic_id} groupId={group.id} />
      </div>

      {/* Lista de equipos */}
      {teams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 sm:px-6 py-10 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-2">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500">Este grupo aún no tiene equipos. Crea el primero arriba.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {teams.map((t: any) => (
              <li key={t.id}>
                <Link
                  href={`/teams/${t.id}`}
                  className="flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-blue-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {t.name}
                        {t.category && (
                          <span className="ml-2 text-xs text-gray-400 font-normal">{t.category}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {t.playerCount} jugador{t.playerCount !== 1 ? 'es' : ''}
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

      {/* Estudios */}
      <div className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-blue-500" /> Estudios
        </h2>
        <CreateCampaignForm
          clinicId={profile.clinic_id}
          groupId={group.id}
          teams={teams.map((t: any) => ({ id: t.id, name: t.name }))}
        />
        {(campaigns || []).length === 0 ? (
          <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-200 px-4 py-6 text-center">
            Sin estudios en este grupo.
          </p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {(campaigns || []).map((c: any) => (
                <li key={c.id}>
                  <Link href={`/estudios/${c.id}`} className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        {c.status === 'closed' ? 'Cerrada' : 'Activa'}
                        {c.start_date ? ` · desde ${new Date(c.start_date).toLocaleDateString('es-ES')}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
