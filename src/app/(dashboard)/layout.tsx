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
    <div className="min-h-screen bg-gray-50">
      <Sidebar userName={userName} />
      {/* pt-14 for mobile header, pb-20 for mobile bottom nav, lg: only ml-64 */}
      <main className="pt-16 pb-20 px-4 lg:pt-8 lg:pb-8 lg:px-8 lg:ml-64">
        {children}
      </main>
    </div>
  )
}
