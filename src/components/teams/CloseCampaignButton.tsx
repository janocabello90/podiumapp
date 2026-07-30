'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CloseCampaignButton({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  if (status === 'closed') {
    return <span className="text-xs text-gray-400">Estudio cerrado</span>
  }

  async function close() {
    if (!confirm('¿Cerrar el estudio? Podrás seguir consultándolo pero se marcará como finalizado.')) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', campaignId)
      if (error) throw error
      toast.success('Estudio cerrado')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al cerrar')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={close}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
      Cerrar estudio
    </button>
  )
}
