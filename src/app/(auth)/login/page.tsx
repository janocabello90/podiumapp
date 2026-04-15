'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error('Credenciales incorrectas')
      setLoading(false)
      return
    }

    toast.success('Sesión iniciada')
    router.push('/patients')
    router.refresh()
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Introduce tu email')
      return
    }
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    if (error) {
      // Show specific error messages
      if (error.message?.includes('rate limit') || error.message?.includes('Rate limit')) {
        toast.error('Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.')
      } else if (error.message?.includes('not found') || error.message?.includes('User not found')) {
        // Don't reveal if email exists or not for security
        setResetSent(true)
        toast.success('Si el email existe, recibirás un enlace')
        setLoading(false)
        return
      } else {
        toast.error(`Error: ${error.message || 'No se pudo enviar el email. Inténtalo de nuevo.'}`)
      }
      console.error('Reset password error:', error)
    } else {
      setResetSent(true)
      toast.success('Email enviado')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-900 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Podium</h1>
          <p className="text-gray-500 mt-1">Plataforma de gestión clínica</p>
        </div>

        {/* Login Form */}
        {mode === 'login' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@clinica.com"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setResetSent(false) }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        )}

        {/* Reset Password Form */}
        {mode === 'reset' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <button
              onClick={() => { setMode('login'); setResetSent(false) }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al login
            </button>

            {resetSent ? (
              <div className="text-center space-y-3 py-4">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">Revisa tu email</h3>
                <p className="text-sm text-gray-500">
                  Te hemos enviado un enlace a <strong>{email}</strong> para restablecer tu contraseña. Revisa también la carpeta de spam.
                </p>
                <button
                  onClick={() => { setMode('login'); setResetSent(false) }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
                >
                  Volver al login
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">Restablecer contraseña</h3>
                  <p className="text-sm text-gray-500">
                    Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.
                  </p>
                </div>

                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@clinica.com"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Método Podium · Fisioterapia basada en evidencia
        </p>

        <div className="text-center text-xs text-gray-400 mt-4 space-x-3">
          <Link href="/aviso-legal" className="hover:text-gray-600">
            Aviso legal
          </Link>
          <span>·</span>
          <Link href="/privacidad" className="hover:text-gray-600">
            Privacidad
          </Link>
          <span>·</span>
          <Link href="/cookies" className="hover:text-gray-600">
            Cookies
          </Link>
        </div>
      </div>
    </div>
  )
}
