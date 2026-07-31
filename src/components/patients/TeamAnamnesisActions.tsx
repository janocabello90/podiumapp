'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Send, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type Player = { id: string; hasAnamnesis: boolean }

export default function TeamAnamnesisActions({ clinicId, players }: { clinicId: string; players: Player[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const missing = players.filter((p) => !p.hasAnamnesis)

  if (missing.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <Check className="w-3.5 h-3.5" /> Todos con anamnesis
      </span>
    )
  }

  async function generateMissing() {
    if (!confirm(`¿Generar enlace de anamnesis para ${missing.length} jugador(es) sin anamnesis?`)) return
    setLoading(true)
    try {
      const rows = missing.map((p) => ({ patient_id: p.id, clinic_id: clinicId }))
      const { error } = await supabase.from('anamnesis_forms').insert(rows)
      if (error) throw error
      toast.success(`${missing.length} enlace(s) de anamnesis generados`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al generar')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={generateMissing}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-clinical-primary hover:underline disabled:opacity-50 font-medium"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
      Generar anamnesis que faltan ({missing.length})
    </button>
  )
}
