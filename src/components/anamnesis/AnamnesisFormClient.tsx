'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { ANAMNESIS_BLOCKS, type AnamnesisField } from './anamnesisFields'

interface Props {
  anamnesisId: string
  token: string
  patientName: string
  existingData: Record<string, any>
}

export default function AnamnesisFormClient({ anamnesisId, token, patientName, existingData }: Props) {
  const supabase = createClient()
  const [currentBlock, setCurrentBlock] = useState(0)
  const [currentField, setCurrentField] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>(existingData)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)

  // Flatten all visible fields for the current block
  const block = ANAMNESIS_BLOCKS[currentBlock]
  const fields = block?.fields.filter((f) => {
    if (!f.condition) return true
    return f.condition(formData)
  }) || []

  const field = fields[currentField]
  const totalBlocks = ANAMNESIS_BLOCKS.length
  const progressPercent = ((currentBlock / totalBlocks) * 100).toFixed(0)

  // Auto-save every time formData changes
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

  function nextField() {
    if (currentField < fields.length - 1) {
      setCurrentField(currentField + 1)
    } else if (currentBlock < totalBlocks - 1) {
      setCurrentBlock(currentBlock + 1)
      setCurrentField(0)
    }
  }

  function prevField() {
    if (currentField > 0) {
      setCurrentField(currentField - 1)
    } else if (currentBlock > 0) {
      setCurrentBlock(currentBlock - 1)
      const prevFields = ANAMNESIS_BLOCKS[currentBlock - 1].fields.filter((f) =>
        !f.condition || f.condition(formData)
      )
      setCurrentField(prevFields.length - 1)
    }
  }

  const isLastField = currentBlock === totalBlocks - 1 && currentField === fields.length - 1

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

  // Consent screen (before first question)
  if (!consentGiven && currentBlock === 0 && currentField === 0) {
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
              Antes de tu primera visita, necesitamos que rellenes este formulario de anamnesis. Solo te llevará unos minutos y nos ayudará a preparar mejor tu sesión.
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
                Se utilizan para preparar tu informe personalizado
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-100">
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-gray-400">
            {block?.title}
          </span>
          <span className="text-xs text-gray-400">
            {Number(progressPercent)}%
          </span>
        </div>
      </div>

      {/* Field */}
      <div className="flex-1 flex items-center justify-center px-4 pt-16 pb-24">
        <div className="w-full max-w-lg">
          {field && <FieldRenderer field={field} value={formData[field.key]} onChange={(val) => updateField(field.key, val)} />}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={prevField}
            disabled={currentBlock === 0 && currentField === 0}
            className="flex items-center gap-1 px-4 py-2.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-sm rounded-xl transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          {isLastField ? (
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
              onClick={nextField}
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
          <label className="block text-lg font-medium text-gray-900 mb-2">
            {field.label}
          </label>
          {field.description && (
            <p className="text-sm text-gray-500 mb-4">{field.description}</p>
          )}
          <input
            type={field.type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      )

    case 'textarea':
      return (
        <div>
          <label className="block text-lg font-medium text-gray-900 mb-2">
            {field.label}
          </label>
          {field.description && (
            <p className="text-sm text-gray-500 mb-4">{field.description}</p>
          )}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
        </div>
      )

    case 'select':
      return (
        <div>
          <label className="block text-lg font-medium text-gray-900 mb-2">
            {field.label}
          </label>
          {field.description && (
            <p className="text-sm text-gray-500 mb-4">{field.description}</p>
          )}
          <div className="space-y-2">
            {field.options?.map((option) => (
              <button
                key={option}
                onClick={() => onChange(option)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-base transition-colors ${
                  value === option
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
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
          <label className="block text-lg font-medium text-gray-900 mb-2">
            {field.label}
          </label>
          {field.description && (
            <p className="text-sm text-gray-500 mb-4">{field.description}</p>
          )}
          <div className="space-y-2">
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
                  className={`w-full text-left px-4 py-3 rounded-xl border text-base transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded border flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    {option}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )

    case 'scale':
      const scaleValue = value || 0
      return (
        <div>
          <label className="block text-lg font-medium text-gray-900 mb-2">
            {field.label}
          </label>
          {field.description && (
            <p className="text-sm text-gray-500 mb-4">{field.description}</p>
          )}
          <div className="flex gap-2 justify-center">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => onChange(i)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${
                  scaleValue === i
                    ? 'bg-blue-600 text-white'
                    : i <= scaleValue
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Sin dolor</span>
            <span>Máximo dolor</span>
          </div>
        </div>
      )

    case 'boolean':
      return (
        <div>
          <label className="block text-lg font-medium text-gray-900 mb-2">
            {field.label}
          </label>
          {field.description && (
            <p className="text-sm text-gray-500 mb-4">{field.description}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => onChange(true)}
              className={`flex-1 px-4 py-3 rounded-xl border text-base font-medium transition-colors ${
                value === true
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              Sí
            </button>
            <button
              onClick={() => onChange(false)}
              className={`flex-1 px-4 py-3 rounded-xl border text-base font-medium transition-colors ${
                value === false
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
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
          <label className="block text-lg font-medium text-gray-900 mb-2">
            {field.label}
          </label>
          {field.description && (
            <p className="text-sm text-gray-500 mb-4">{field.description}</p>
          )}
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      )

    default:
      return null
  }
}
