'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CreateTeamForm({ clinicId, groupId }: { clinicId: string; groupId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('El nombre del equipo es obligatorio')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('teams')
        .insert({
          clinic_id: clinicId,
          group_id: groupId,
          name: name.trim(),
          category: category.trim() || null,
        })
      if (error) throw error
      setName('')
      setCategory('')
      toast.success('Equipo creado')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear el equipo')
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
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nuevo equipo (ej. Cádiz A)"
        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
      <input
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Categoría (opcional)"
        className="sm:w-44 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span>{loading ? 'Creando...' : 'Crear equipo'}</span>
      </button>
    </form>
  )
}
