'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ClassifyBanner({ unclassifiedCount }: { unclassifiedCount: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (unclassifiedCount === 0 || dismissed) return null

  async function run() {
    setLoading(true)
    try {
      const res = await fetch('/api/patients/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backfill: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al clasificar')
        setLoading(false)
        return
      }
      const classified = (data.results || []).filter((r: any) => r.classification).length
      toast.success(`${classified} paciente${classified !== 1 ? 's' : ''} clasificado${classified !== 1 ? 's' : ''}`)
      router.refresh()
    } catch (e) {
      toast.error('Error al clasificar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl px-4 sm:px-5 py-3 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <p className="text-sm text-indigo-900 min-w-0">
          <span className="font-medium">{unclassifiedCount} paciente{unclassifiedCount !== 1 ? 's' : ''} sin clasificar.</span>{' '}
          <span className="hidden sm:inline text-indigo-700">La IA puede extraer región, patología y nivel de actividad desde anamnesis e informes.</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-indigo-700 hover:text-indigo-900 underline hidden sm:inline"
        >
          Ahora no
        </button>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Clasificando...' : 'Clasificar con IA'}
        </button>
      </div>
    </div>
  )
}
