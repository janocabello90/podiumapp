'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StartSessionButton({
  patientId,
  label = 'Iniciar valoración',
}: {
  patientId: string
  label?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear la sesión')
      router.push(`/patients/${patientId}/sessions/${data.sessionId}`)
    } catch (err: any) {
      toast.error(err.message || 'Error al crear la sesión')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />}
      {label}
    </button>
  )
}
