import { createClient } from '@supabase/supabase-js'
import TeamInvitePublicForm from '@/components/teams/TeamInvitePublicForm'

export const dynamic = 'force-dynamic'

// Página PÚBLICA (fuera del grupo (dashboard) → sin sidebar). Autorización = token válido + activo.
// La validación va por service_role; nunca se muestra el roster existente (write-only, sin fuga de PII).
export default async function AltaPage({ params }: { params: { token: string } }) {
  const { token } = params
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  let team: { name: string } | null = null
  let error: string | null = null

  if (!token || token.length < 20) {
    error = 'Este enlace no es válido.'
  } else if (!serviceRoleKey) {
    error = 'El servicio no está disponible ahora mismo.'
  } else {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await admin.from('teams').select('name, invite_active').eq('invite_token', token).single()
    if (!data) error = 'Este enlace no es válido o ha sido desactivado.'
    else if (!data.invite_active) error = 'Este enlace ha sido desactivado.'
    else team = { name: data.name }
  }

  return (
    <div className="min-h-screen bg-clinical-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <header className="mb-6 text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Alta de jugadores</h1>
          {team && <p className="text-sm text-gray-500 mt-1">Equipo: <strong>{team.name}</strong></p>}
        </header>

        {error ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-700">{error}</p>
            <p className="text-xs text-gray-400 mt-2">Pide un enlace nuevo a la clínica.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4 text-center">
              Añade los jugadores de este equipo, uno a uno o subiendo un CSV/Excel. Solo el nombre es obligatorio.
            </p>
            <TeamInvitePublicForm token={token} teamName={team!.name} />
          </>
        )}
      </div>
    </div>
  )
}
