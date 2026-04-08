'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * This page handles Supabase auth email links that use hash fragments.
 * Supabase sometimes puts tokens in the URL hash (#access_token=...)
 * which the server can't see. This client page captures them.
 */
export default function AuthConfirmPage() {
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function handleAuth() {
      // The Supabase client automatically picks up hash fragments
      // and exchanges them for a session via onAuthStateChange
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Auth confirm error:', sessionError)
        setError('Error al verificar tu enlace. Puede haber expirado.')
        return
      }

      if (session) {
        // Check if this is a recovery/invite flow
        const hash = window.location.hash
        if (hash.includes('type=recovery') || hash.includes('type=invite')) {
          router.push('/auth/update-password')
        } else {
          router.push('/patients')
        }
        return
      }

      // If no session yet, wait for auth state change (Supabase processes the hash)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          router.push('/auth/update-password')
        } else if (event === 'SIGNED_IN' && session) {
          router.push('/auth/update-password')
        }
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        subscription.unsubscribe()
        setError('No se pudo verificar el enlace. Puede haber expirado o ya fue usado.')
      }, 10000)
    }

    handleAuth()
  }, [supabase, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-900 rounded-2xl mb-4">
          <span className="text-2xl font-bold text-white">P</span>
        </div>

        {error ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{error}</p>
            <a
              href="/login"
              className="inline-block px-4 py-2 bg-blue-900 text-white text-sm font-medium rounded-xl hover:bg-blue-800 transition-colors"
            >
              Ir al login
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm text-gray-500">Verificando tu enlace...</p>
          </div>
        )}
      </div>
    </div>
  )
}
