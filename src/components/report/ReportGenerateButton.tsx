'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, AlertTriangle, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  patientId: string
  sessionId?: string
  hasExisting?: boolean
}

interface RefOption {
  id: string
  name: string
  profile: string
  compatible: boolean
  reasons: string[]
}

export default function ReportGenerateButton({ patientId, sessionId, hasExisting }: Props) {
  const [generating, setGenerating] = useState(false)
  const [refs, setRefs] = useState<RefOption[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const router = useRouter()

  // Cargar referencias/baremos disponibles para este jugador (compatibles pre-marcadas).
  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ patientId })
    if (sessionId) params.set('sessionId', sessionId)
    fetch(`/api/reports/references?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { references: [] }))
      .then((data) => {
        if (!active) return
        const list: RefOption[] = data.references || []
        setRefs(list)
        const init: Record<string, boolean> = {}
        for (const r of list) init[r.id] = r.compatible // por defecto, marcar solo las compatibles
        setSelected(init)
      })
      .catch(() => {})
    return () => { active = false }
  }, [patientId, sessionId])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const referenceIds = refs.filter((r) => selected[r.id]).map((r) => r.id)
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, sessionId, referenceIds }),
      })

      if (response.status === 409) {
        toast('Ya se está generando un informe para esta sesión.')
        router.refresh()
        setGenerating(false)
        return
      }

      if (!response.ok && response.status !== 202) {
        const err = await response.json()
        throw new Error(err.error || 'Error al generar')
      }

      // 202: se genera en segundo plano. La página mostrará el panel de "Generando…".
      toast.success('Generando en segundo plano; puedes cerrar la página.')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al generar el informe')
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-3">
      {refs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Referencias / baremos a adjuntar a la IA</p>
          <div className="space-y-1.5">
            {refs.map((r) => (
              <label key={r.id} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!selected[r.id]}
                  onChange={() => setSelected((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="min-w-0">
                  <span className="text-sm text-gray-900">{r.name}</span>
                  <span className="block text-[11px] text-gray-400">{r.profile}</span>
                  {r.compatible ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-600"><Check className="w-3 h-3" /> Compatible con el jugador</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="w-3 h-3" /> Perfil no coincide: {r.reasons.join(', ')}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors"
      >
        {generating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Iniciando…
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            {hasExisting ? 'Regenerar informe' : 'Generar informe'}
          </>
        )}
      </button>
    </div>
  )
}
