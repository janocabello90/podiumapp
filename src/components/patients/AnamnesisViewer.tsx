'use client'

import { useState, useCallback, useRef } from 'react'
import { X, ChevronDown, ChevronUp, Check, Pencil, Save, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react'
import { ANAMNESIS_BLOCKS } from '@/components/anamnesis/anamnesisFields'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Props {
  formData: Record<string, any>
  patientName: string
  completedAt: string | null
  anamnesisId: string
}

function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') return '—'
  if (value === true) return 'Sí'
  if (value === false) return 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number') return String(value)
  return String(value)
}

export default function AnamnesisViewer({ formData: initialFormData, patientName, completedAt, anamnesisId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set(['consultation']))
  const [formData, setFormData] = useState<Record<string, any>>(initialFormData)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [blockNotes, setBlockNotes] = useState<Record<string, string>>(() => {
    // Load existing notes from formData
    const notes: Record<string, string> = {}
    ANAMNESIS_BLOCKS.forEach(block => {
      const key = `_notes_${block.id}`
      if (formData[key]) notes[block.id] = formData[key]
    })
    return notes
  })
  const [showNotes, setShowNotes] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Auto-save to Supabase
  const saveToSupabase = useCallback(async (updatedData: Record<string, any>) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('anamnesis_forms')
        .update({ form_data: updatedData })
        .eq('id', anamnesisId)

      if (error) throw error
    } catch (err: any) {
      toast.error('Error al guardar: ' + (err.message || 'Inténtalo de nuevo'))
    } finally {
      setSaving(false)
    }
  }, [anamnesisId, supabase])

  // Debounced save
  function debouncedSave(updatedData: Record<string, any>) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveToSupabase(updatedData), 1000)
  }

  // Toggle verified status for a field
  function toggleVerified(fieldKey: string) {
    const verifiedKey = `_verified_${fieldKey}`
    const updated = { ...formData, [verifiedKey]: !formData[verifiedKey] }
    setFormData(updated)
    debouncedSave(updated)
  }

  // Start editing a field
  function startEdit(fieldKey: string) {
    setEditingField(fieldKey)
    const val = formData[fieldKey]
    setEditValue(val !== null && val !== undefined ? String(val) : '')
  }

  // Save edited field
  function saveEdit(fieldKey: string) {
    const editedKey = `_edited_${fieldKey}`
    const originalKey = `_original_${fieldKey}`

    const updated = {
      ...formData,
      // Save original value if first edit
      ...(formData[originalKey] === undefined ? { [originalKey]: formData[fieldKey] } : {}),
      [fieldKey]: editValue,
      [editedKey]: true,
    }
    setFormData(updated)
    setEditingField(null)
    debouncedSave(updated)
    toast.success('Respuesta editada')
  }

  // Update block notes
  function updateBlockNotes(blockId: string, value: string) {
    setBlockNotes(prev => ({ ...prev, [blockId]: value }))
    const notesKey = `_notes_${blockId}`
    const updated = { ...formData, [notesKey]: value }
    setFormData(updated)
    debouncedSave(updated)
  }

  function toggleBlock(id: string) {
    setExpandedBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleNotes(blockId: string) {
    setShowNotes(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  // Count verified fields
  const totalAnswered = ANAMNESIS_BLOCKS.reduce((acc, block) => {
    return acc + block.fields.filter(f => formData[f.key] !== undefined && formData[f.key] !== '' && formData[f.key] !== null).length
  }, 0)
  const totalVerified = ANAMNESIS_BLOCKS.reduce((acc, block) => {
    return acc + block.fields.filter(f => formData[`_verified_${f.key}`]).length
  }, 0)

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
            <div className="flex items-center gap-3 mt-1">
              {completedAt && (
                <p className="text-xs text-gray-400">
                  Completada el {new Date(completedAt).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </p>
              )}
              <span className="text-xs text-gray-400">·</span>
              <span className={`text-xs font-medium ${totalVerified === totalAnswered && totalAnswered > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {totalVerified}/{totalAnswered} verificadas
              </span>
              {saving && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Guardando...
                </span>
              )}
            </div>
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
            const verifiedCount = answeredFields.filter(f => formData[`_verified_${f.key}`]).length
            const allVerified = verifiedCount === answeredFields.length && answeredFields.length > 0

            if (answeredFields.length === 0) return null

            return (
              <div key={block.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleBlock(block.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {allVerified && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    <h3 className="text-sm font-semibold text-gray-900">{block.title}</h3>
                    <span className="text-xs text-gray-400">
                      {verifiedCount}/{answeredFields.length} verificadas
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {answeredFields.map((field) => {
                      const isVerified = formData[`_verified_${field.key}`]
                      const isEdited = formData[`_edited_${field.key}`]
                      const isEditing = editingField === field.key

                      return (
                        <div
                          key={field.key}
                          className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                            isVerified ? 'bg-green-50/50' : 'bg-gray-50 hover:bg-gray-100/50'
                          }`}
                        >
                          {/* Verify checkbox */}
                          <button
                            onClick={() => toggleVerified(field.key)}
                            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isVerified
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {isVerified && <Check className="w-3 h-3" />}
                          </button>

                          {/* Field content */}
                          <div className="flex-1 min-w-0">
                            <dt className="text-gray-400 text-xs flex items-center gap-1">
                              {field.label}
                              {isEdited && (
                                <span className="text-amber-500 text-[10px] font-medium">(editado)</span>
                              )}
                            </dt>

                            {isEditing ? (
                              <div className="mt-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(field.key)
                                    if (e.key === 'Escape') setEditingField(null)
                                  }}
                                />
                                <button
                                  onClick={() => saveEdit(field.key)}
                                  className="p-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingField(null)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <dd className="text-gray-800 mt-0.5 text-sm font-medium">
                                {field.type === 'scale' ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="font-bold text-blue-600">{formData[field.key]}</span>
                                    <span className="text-xs text-gray-400">/ 10</span>
                                  </span>
                                ) : (
                                  formatValue(formData[field.key])
                                )}
                              </dd>
                            )}
                          </div>

                          {/* Edit button */}
                          {!isEditing && (
                            <button
                              onClick={() => startEdit(field.key)}
                              className="mt-0.5 flex-shrink-0 p-1 text-gray-300 hover:text-blue-500 transition-colors"
                              title="Editar respuesta"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}

                    {/* Block notes */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => toggleNotes(block.id)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {blockNotes[block.id] ? 'Editar notas clínicas' : 'Añadir notas clínicas'}
                      </button>
                      {showNotes.has(block.id) && (
                        <textarea
                          value={blockNotes[block.id] || ''}
                          onChange={(e) => updateBlockNotes(block.id, e.target.value)}
                          placeholder={`Notas del fisio sobre ${block.title.toLowerCase()}...`}
                          className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      )}
                      {!showNotes.has(block.id) && blockNotes[block.id] && (
                        <p className="mt-1 text-xs text-gray-500 italic">
                          &ldquo;{blockNotes[block.id].substring(0, 80)}{blockNotes[block.id].length > 80 ? '...' : ''}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {totalVerified === totalAnswered && totalAnswered > 0 ? (
              <span className="text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Todas las respuestas verificadas
              </span>
            ) : (
              `${totalAnswered - totalVerified} respuestas pendientes de verificar`
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
