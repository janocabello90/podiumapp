'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight, ChevronLeft, Check, Mic, MicOff, Loader2 } from 'lucide-react'
import { ANAMNESIS_BLOCKS, type AnamnesisField } from './anamnesisFields'
import toast from 'react-hot-toast'

interface Props {
  anamnesisId: string
  token: string
  patientName: string
  existingData: Record<string, any>
}

export default function AnamnesisFormClient({ anamnesisId, token, patientName, existingData }: Props) {
  const supabase = createClient()
  const [currentBlock, setCurrentBlock] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>(existingData)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalBlocks = ANAMNESIS_BLOCKS.length
  const block = ANAMNESIS_BLOCKS[currentBlock]
  const fields = block?.fields.filter((f) => {
    if (!f.condition) return true
    return f.condition(formData)
  }) || []

  const progressPercent = Math.round(((currentBlock) / totalBlocks) * 100)

  // Auto-save
  const autoSave = useCallback(async () => {
    if (Object.keys(formData).length === 0) return
    try {
      await supabase
        .from('anamnesis_forms')
        .update({
          form_data: formData,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('token', token)
    } catch (e) {
      console.error('Auto-save error:', e)
    }
  }, [formData, token, supabase])

  useEffect(() => {
    const timeout = setTimeout(autoSave, 2000)
    return () => clearTimeout(timeout)
  }, [formData, autoSave])

  function updateField(key: string, value: any) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function nextBlock() {
    if (currentBlock < totalBlocks - 1) {
      setCurrentBlock(currentBlock + 1)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function prevBlock() {
    if (currentBlock > 0) {
      setCurrentBlock(currentBlock - 1)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const isLastBlock = currentBlock === totalBlocks - 1

  async function submitForm() {
    setSaving(true)
    try {
      await supabase
        .from('anamnesis_forms')
        .update({
          form_data: formData,
          status: 'completed',
          completed_at: new Date().toISOString(),
          consent_data_processing: true,
          consent_ai_analysis: consentGiven,
          consent_timestamp: new Date().toISOString(),
        })
        .eq('token', token)

      setCompleted(true)
    } catch (e) {
      console.error('Submit error:', e)
    } finally {
      setSaving(false)
    }
  }

  // Completed screen
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">¡Listo!</h1>
          <p className="text-gray-500 mt-2">
            Hemos recibido tus respuestas. Tu fisioterapeuta las revisará antes de tu cita. ¡Gracias, {patientName}!
          </p>
        </div>
      </div>
    )
  }

  // Consent screen
  if (!consentGiven && currentBlock === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-900 rounded-2xl mb-4">
              <span className="text-xl font-bold text-white">P</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Hola{patientName ? `, ${patientName.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Antes de tu primera visita, necesitamos que rellenes este formulario. Solo te llevará unos minutos y nos ayudará a preparar mejor tu sesión.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 text-sm mb-3">Sobre tus datos</h3>
            <ul className="space-y-2 text-sm text-gray-600 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Tus datos son confidenciales y están protegidos
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Solo tu fisioterapeuta tendrá acceso
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Puedes usar el micrófono para dictar las respuestas largas
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                Puedes interrumpir y continuar en cualquier momento
              </li>
            </ul>

            <button
              onClick={() => setConsentGiven(true)}
              className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-medium rounded-xl transition-colors"
            >
              Empezar formulario
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Check if block is all booleans (for compact grid layout)
  const allBooleans = fields.every(f => f.type === 'boolean')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-100">
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs font-medium text-gray-500">
            {block?.title}
          </span>
          <span className="text-xs text-gray-400">
            {currentBlock + 1} / {totalBlocks}
          </span>
        </div>
      </div>

      {/* Block content - all fields at once */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-20 pb-28">
        <div className="w-full max-w-lg mx-auto">
          {/* Block header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">{block?.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{block?.description}</p>
          </div>

          {/* Compact boolean grid */}
          {allBooleans ? (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              {fields.map((f) => (
                <BooleanRow
                  key={f.key}
                  field={f}
                  value={formData[f.key]}
                  onChange={(val) => updateField(f.key, val)}
                />
              ))}
            </div>
          ) : (
            /* Regular field list */
            <div className="space-y-6">
              {fields.map((f) => (
                <div key={f.key} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <FieldRenderer
                    field={f}
                    value={formData[f.key]}
                    onChange={(val) => updateField(f.key, val)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={prevBlock}
            disabled={currentBlock === 0}
            className="flex items-center gap-1 px-4 py-2.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-sm rounded-xl transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          {isLastBlock ? (
            <button
              onClick={submitForm}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar formulario'}
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={nextBlock}
              className="flex items-center gap-1 px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-medium text-sm rounded-xl transition-colors"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Compact Boolean Row (for Red Flags, etc.)
// ============================================
function BooleanRow({
  field,
  value,
  onChange,
}: {
  field: AnamnesisField
  value: any
  onChange: (val: any) => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{field.label}</p>
        {field.description && (
          <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === true
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Sí
        </button>
        <button
          onClick={() => onChange(false)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === false
              ? 'bg-gray-700 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

// ============================================
// Inline Voice Dictation for textareas
// ============================================
function InlineDictation({
  currentText,
  onTranscription,
}: {
  currentText: string
  onTranscription: (text: string) => void
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunks.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        const audioBlob = new Blob(chunks.current, { type: 'audio/webm' })

        if (audioBlob.size < 1000) {
          toast.error('Grabación demasiado corta')
          return
        }

        setIsTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || 'Error de transcripción')
          }

          const { text } = await response.json()
          if (text && text.trim()) {
            const newText = currentText
              ? `${currentText} ${text.trim()}`
              : text.trim()
            onTranscription(newText)
            toast.success('Dictado transcrito')
          } else {
            toast.error('No se detectó texto')
          }
        } catch (err: any) {
          toast.error(err.message || 'Error al transcribir')
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start()
      mediaRecorder.current = recorder
      setIsRecording(true)
    } catch {
      toast.error('No se pudo acceder al micrófono')
    }
  }, [currentText, onTranscription])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop()
      setIsRecording(false)
    }
  }, [])

  if (isTranscribing) {
    return (
      <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-400 text-xs font-medium rounded-lg">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Transcribiendo...
      </button>
    )
  }

  if (isRecording) {
    return (
      <button
        onClick={stopRecording}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors animate-pulse"
      >
        <MicOff className="w-3.5 h-3.5" />
        Parar
      </button>
    )
  }

  return (
    <button
      onClick={startRecording}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium rounded-lg transition-colors"
    >
      <Mic className="w-3.5 h-3.5" />
      Dictar
    </button>
  )
}

// ============================================
// Field Renderer Component
// ============================================
function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: AnamnesisField
  value: any
  onChange: (val: any) => void
}) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'tel':
    case 'number':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <input
            type={field.type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      )

    case 'textarea':
      return (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-900">
              {field.label}
            </label>
            <InlineDictation
              currentText={value || ''}
              onTranscription={(text) => onChange(text)}
            />
          </div>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
        </div>
      )

    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {field.options?.map((option) => (
              <button
                key={option}
                onClick={() => onChange(option)}
                className={`px-4 py-2 rounded-xl border text-sm transition-colors ${
                  value === option
                    ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )

    case 'multiselect':
      const selected: string[] = value || []
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {field.options?.map((option) => {
              const isSelected = selected.includes(option)
              return (
                <button
                  key={option}
                  onClick={() => {
                    onChange(
                      isSelected
                        ? selected.filter((s) => s !== option)
                        : [...selected, option]
                    )
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      )

    case 'scale':
      const scaleValue = value ?? null
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <div className="flex gap-1.5 justify-center flex-wrap">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => onChange(i)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${
                  scaleValue === i
                    ? 'bg-blue-600 text-white shadow-sm'
                    : scaleValue !== null && i <= scaleValue
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400 px-1">
            <span>Nada</span>
            <span>Máximo</span>
          </div>
        </div>
      )

    case 'boolean':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => onChange(true)}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                value === true
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              Sí
            </button>
            <button
              onClick={() => onChange(false)}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                value === false
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              No
            </button>
          </div>
        </div>
      )

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      )

    default:
      return null
  }
}
