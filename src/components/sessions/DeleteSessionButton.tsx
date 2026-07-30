'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm('¿Borrar esta consulta? Se eliminará la valoración y sus pruebas. Los documentos e informes asociados se conservan (quedan a nivel de paciente).')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
      if (error) throw error
      toast.success('Consulta borrada')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al borrar')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Borrar consulta"
      className="text-gray-300 hover:text-red-500 transition-colors p-1 -m-1 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  )
}
