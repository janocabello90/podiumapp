'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  patientId: string
}

export default function ReportGenerateButton({ patientId }: Props) {
  const [generating, setGenerating] = useState(false)
  const router = useRouter()

  async function handleGenerate() {
    setGenerating(true)
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error al generar')
      }

      toast.success('Informe generado correctamente')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al generar el informe')
    }
    setGenerating(false)
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={generating}
      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors"
    >
      {generating ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Generando informe... (30-60s)
        </>
      ) : (
        <>
          <Sparkles className="w-5 h-5" />
          Generar informe
        </>
      )}
    </button>
  )
}
