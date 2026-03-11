import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, clinic_id')
    .eq('id', user.id)
    .single()

  const userName = profile?.full_name || user.email || 'Usuario'

  return (
    <div className="min-h-screen">
      <Sidebar userName={userName} />
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  )
}
