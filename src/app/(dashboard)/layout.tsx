import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

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
    <div className="min-h-screen bg-clinical-bg">
      <Sidebar userName={userName} />
      <div className="lg:ml-64">
        <Suspense fallback={<div className="hidden lg:block h-14 border-b border-gray-200" />}>
          <TopBar />
        </Suspense>
        {/* pt-16 for mobile header, pb-20 for mobile bottom nav */}
        <main className="pt-16 pb-20 px-4 lg:pt-6 lg:pb-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
