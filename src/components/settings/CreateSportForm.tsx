'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CreateSportForm({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('El nombre del deporte es obligatorio')
    setLoading(true)
    try {
      const { error } = await supabase
        .from('sports')
        .insert({ clinic_id: clinicId, name: name.trim(), description: description.trim() || null })
      if (error) throw error
      setName('')
      setDescription('')
      toast.success('Deporte creado')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message?.includes('duplicate') ? 'Ya existe un deporte con ese nombre' : (err.message || 'Error al crear'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nuevo deporte (ej. Fútbol)"
        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional)"
        className="sm:w-52 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
      >
        <Plus className="w-4 h-4" />
        {loading ? 'Creando...' : 'Crear deporte'}
      </button>
    </form>
  )
}
