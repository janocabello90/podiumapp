'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CreateGroupForm({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('El nombre del grupo es obligatorio')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('groups')
        .insert({ clinic_id: clinicId, name: name.trim() })
      if (error) throw error
      setName('')
      toast.success('Grupo creado')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear el grupo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 flex items-center gap-2 sm:gap-3"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nuevo grupo (ej. Cádiz)"
        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">{loading ? 'Creando...' : 'Crear grupo'}</span>
      </button>
    </form>
  )
}
