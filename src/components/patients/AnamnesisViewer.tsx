'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { ANAMNESIS_BLOCKS } from '@/components/anamnesis/anamnesisFields'

interface Props {
  formData: Record<string, any>
  patientName: string
  completedAt: string | null
}

function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') return '—'
  if (value === true) return 'Sí'
  if (value === false) return 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number') return String(value)
  return String(value)
}

export default function AnamnesisViewer({ formData, patientName, completedAt }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set(['consultation']))

  function toggleBlock(id: string) {
    setExpandedBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Ver respuestas
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Anamnesis de {patientName}</h2>
            {completedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                Completada el {new Date(completedAt).toLocaleDateString('es-ES', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {ANAMNESIS_BLOCKS.map((block) => {
            const isExpanded = expandedBlocks.has(block.id)
            const answeredFields = block.fields.filter(
              (f) => formData[f.key] !== undefined && formData[f.key] !== '' && formData[f.key] !== null
            )

            if (answeredFields.length === 0) return null

            return (
              <div key={block.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleBlock(block.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{block.title}</h3>
                    <span className="text-xs text-gray-400">
                      {answeredFields.length} respuestas
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {answeredFields.map((field) => (
                      <div key={field.key} className="text-sm">
                        <dt className="text-gray-400 text-xs">{field.label}</dt>
                        <dd className="text-gray-800 mt-0.5 font-medium">
                          {field.type === 'scale' ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="font-bold text-blue-600">{formData[field.key]}</span>
                              <span className="text-xs text-gray-400">/ 10</span>
                            </span>
                          ) : (
                            formatValue(formData[field.key])
                          )}
                        </dd>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
