'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      toast.error('Error al actualizar la contraseña. Inténtalo de nuevo.')
      console.error('Update password error:', error)
      setLoading(false)
      return
    }

    setSuccess(true)
    toast.success('Contraseña actualizada')

    // Redirect to dashboard after a short delay
    setTimeout(() => {
      router.push('/patients')
      router.refresh()
    }, 2000)
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {success ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="font-semibold text-gray-900">Contraseña actualizada</h3>
              <p className="text-sm text-gray-500">
                Tu contraseña se ha cambiado correctamente. Redirigiendo...
              </p>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Nueva contraseña</h3>
                <p className="text-sm text-gray-500">
                  Elige una nueva contraseña para tu cuenta.
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña nueva
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder:text-gray-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || password.length < 6 || password !== confirmPassword}
                className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Método Podium · Fisioterapia basada en evidencia
        </p>
      </div>
    </div>
  )
}
