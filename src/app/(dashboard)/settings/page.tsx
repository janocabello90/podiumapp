import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Fetch clinic
  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', profile.clinic_id)
    .single()

  // Fetch team members — solo para admins (los fisios no ven a otros usuarios)
  const isAdmin = profile.role === 'admin'
  const { data: teamMembers } = isAdmin
    ? await supabase
        .from('users')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: true })
    : { data: [] as any[] }

  // Última conexión de cada usuario: vive en auth.users (no en public.users), así que se
  // lee con la service_role (admin). Solo para admins; tolerante a fallo (si falta la key o
  // falla, se muestra sin la columna en vez de romper Ajustes).
  let members = teamMembers || []
  if (isAdmin && members.length > 0) {
    try {
      const admin = createAdminSupabaseClient()
      const lastSignInById = new Map<string, string | null>()
      let page = 1
      // Paginar por si la clínica crece (perPage máx. 1000).
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        if (error || !data) break
        for (const u of data.users) lastSignInById.set(u.id, (u as any).last_sign_in_at ?? null)
        if (data.users.length < 1000) break
        page++
      }
      members = members.map((m: any) => ({ ...m, last_sign_in_at: lastSignInById.get(m.id) ?? null }))
    } catch {
      // sin service_role o error: seguimos sin la columna de última conexión
    }
  }

  // Última ACTIVIDAD clínica: lo más reciente que ha hecho cada usuario (crear paciente,
  // trabajar una sesión o generar un informe). Derivado de nuestras tablas (RLS clínica-scoped).
  if (isAdmin && members.length > 0) {
    try {
      const lastActivityById = new Map<string, number>()
      const bump = (id?: string | null, ts?: string | null) => {
        if (!id || !ts) return
        const t = new Date(ts).getTime()
        if (isNaN(t)) return
        const cur = lastActivityById.get(id)
        if (cur === undefined || t > cur) lastActivityById.set(id, t)
      }
      const [pRes, sRes, rRes] = await Promise.all([
        supabase.from('patients').select('created_by, created_at').eq('clinic_id', profile.clinic_id),
        supabase.from('sessions').select('physio_id, updated_at').eq('clinic_id', profile.clinic_id),
        supabase.from('reports').select('generated_by, created_at').eq('clinic_id', profile.clinic_id),
      ])
      for (const row of pRes.data || []) bump((row as any).created_by, (row as any).created_at)
      for (const row of sRes.data || []) bump((row as any).physio_id, (row as any).updated_at)
      for (const row of rRes.data || []) bump((row as any).generated_by, (row as any).created_at)
      members = members.map((m: any) => {
        const t = lastActivityById.get(m.id)
        return { ...m, last_activity_at: t ? new Date(t).toISOString() : null }
      })
    } catch {
      // sin datos o error: seguimos sin la columna de última actividad
    }
  }

  return (
    <SettingsClient
      currentUser={profile}
      currentUserEmail={user.email || ''}
      clinic={clinic}
      teamMembers={members}
    />
  )
}
