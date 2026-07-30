'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  campaignId: string
  valued: number
  total: number
}

export default function CampaignReportButton({ campaignId, valued, total }: Props) {
  const [generating, setGenerating] = useState(false)
  const router = useRouter()

  const disabled = generating || valued < 1

  async function handleGenerate() {
    setGenerating(true)
    try {
      const response = await fetch('/api/reports/campaign-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error al generar')
      }
      toast.success('Informe de estudio generado')
      router.push(`/campaigns/${campaignId}/report`)
    } catch (err: any) {
      toast.error(err.message || 'Error al generar el informe')
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleGenerate}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-xl transition-colors"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generando… (30-90s)
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generar informe de estudio
          </>
        )}
      </button>
      {valued < 1 ? (
        <span className="text-[11px] text-gray-400">Valora al menos a un jugador para generar</span>
      ) : (
        <span className="text-[11px] text-gray-400">Cobertura: {valued}/{total} valorados</span>
      )}
    </div>
  )
}
