import { createServerSupabaseClient } from '@/lib/supabase/server'
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

  return (
    <SettingsClient
      currentUser={profile}
      currentUserEmail={user.email || ''}
      clinic={clinic}
      teamMembers={teamMembers || []}
    />
  )
}
