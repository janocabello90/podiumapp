'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Copy, Check, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import type { AnamnesisForm } from '@/types/database'
import AnamnesisViewer from './AnamnesisViewer'

interface Props {
  patientId: string
  clinicId: string
  patientName: string
  currentAnamnesis: AnamnesisForm | null | undefined
}

export default function AnamnesisActions({ patientId, clinicId, patientName, currentAnamnesis }: Props) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [anamnesisLink, setAnamnesisLink] = useState<string | null>(
    currentAnamnesis?.token
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/anamnesis/${currentAnamnesis.token}`
      : null
  )
  const supabase = createClient()

  async function createAnamnesis() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('anamnesis_forms')
        .insert({
          patient_id: patientId,
          clinic_id: clinicId,
        })
        .select('token')
        .single()

      if (error) throw error

      const link = `${window.location.origin}/anamnesis/${data.token}`
      setAnamnesisLink(link)
      toast.success('Enlace de anamnesis creado')
    } catch (error: any) {
      toast.error(error.message || 'Error al crear anamnesis')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!anamnesisLink) return
    try {
      await navigator.clipboard.writeText(anamnesisLink)
      setCopied(true)
      toast.success('Enlace copiado al portapapeles')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  function openWhatsApp() {
    if (!anamnesisLink) return
    const message = encodeURIComponent(
      `¡Hola! 👋 Antes de tu primera visita en Clínica Podium, necesitamos que rellenes este formulario de anamnesis. Solo te llevará unos minutos:\n\n${anamnesisLink}\n\nGracias y ¡nos vemos pronto!`
    )
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  // Already completed
  if (currentAnamnesis?.status === 'completed') {
    return (
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
          <Check className="w-3 h-3" />
          Completada
        </span>
        <AnamnesisViewer
          formData={currentAnamnesis.form_data || {}}
          patientName={patientName}
          completedAt={currentAnamnesis.completed_at}
          anamnesisId={currentAnamnesis.id}
        />
      </div>
    )
  }

  // Link exists (pending/in_progress)
  if (anamnesisLink) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
          <input
            readOnly
            value={anamnesisLink}
            className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate"
          />
          <button
            onClick={copyLink}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Copiar enlace"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openWhatsApp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Send className="w-3 h-3" />
            Enviar por WhatsApp
          </button>
          <a
            href={anamnesisLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <ExternalLink className="w-3 h-3" />
            Vista previa
          </a>
        </div>
      </div>
    )
  }

  // No anamnesis yet
  return (
    <button
      onClick={createAnamnesis}
      disabled={loading}
      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      <Send className="w-3 h-3" />
      {loading ? 'Generando enlace...' : 'Generar enlace de anamnesis'}
    </button>
  )
}
