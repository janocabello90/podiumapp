'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

function NewPatientForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const teamId = searchParams.get('team_id')
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    notes: '',
  })

  // Si venimos desde un equipo, mostrar su nombre como contexto.
  useEffect(() => {
    if (!teamId) return
    supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()
      .then(({ data }) => setTeamName((data as any)?.name ?? null))
  }, [teamId, supabase])

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: profile } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Perfil no encontrado')

      const { data: patient, error } = await supabase
        .from('patients')
        .insert({
          clinic_id: profile.clinic_id,
          created_by: user.id,
          team_id: teamId || null,
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          notes: form.notes.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      toast.success(teamId ? 'Jugador añadido al equipo' : 'Paciente creado')
      // Si venía de un equipo, volver al roster; si no, a la ficha.
      router.push(teamId ? `/teams/${teamId}` : `/patients/${patient.id}`)
    } catch (error: any) {
      toast.error(error.message || 'Error al crear paciente')
    } finally {
      setLoading(false)
    }
  }

  const backHref = teamId ? `/teams/${teamId}` : '/patients'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link href={backHref} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
          {teamId ? 'Nuevo jugador' : 'Nuevo paciente'}
        </h1>
      </div>

      {/* Contexto de equipo */}
      {teamId && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
          <Users className="w-4 h-4 flex-shrink-0" />
          <span>
            Se añadirá al equipo{teamName ? <> <strong>{teamName}</strong></> : ''}.
          </span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nombre completo *
          </label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
            placeholder="Pedro García López"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Phone + Email — stack on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Teléfono
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+34 612 345 678"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="pedro@email.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* DOB + Gender — stack on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Fecha de nacimiento
            </label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => updateField('date_of_birth', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Sexo
            </label>
            <select
              value={form.gender}
              onChange={(e) => updateField('gender', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">Seleccionar</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Notas internas
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Notas para el equipo..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Creando...' : teamId ? 'Añadir jugador' : 'Crear paciente'}
          </button>
          <Link
            href={backHref}
            className="hidden sm:inline-block px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}

export default function NewPatientPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto text-sm text-gray-400">Cargando…</div>}>
      <NewPatientForm />
    </Suspense>
  )
}
