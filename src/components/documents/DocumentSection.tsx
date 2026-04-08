'use client'

import { useState, useCallback, useRef } from 'react'
import type { Document } from '@/types/database'
import DocumentUploader from './DocumentUploader'
import DocumentList from './DocumentList'
import VoiceDictation from '@/components/assessment/VoiceDictation'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  patientId: string
  clinicId: string
  initialDocuments: Document[]
  initialInterpretation?: string
}

export default function DocumentSection({ patientId, clinicId, initialDocuments, initialInterpretation }: Props) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [interpretation, setInterpretation] = useState(initialInterpretation || '')
  const [showInterpretation, setShowInterpretation] = useState(!!initialInterpretation)
  const [savingInterpretation, setSavingInterpretation] = useState(false)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  function handleUploaded(doc: Document) {
    setDocuments(prev => [doc, ...prev])
  }

  function handleDelete(docId: string) {
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  // Save interpretation to patient notes or a dedicated field
  const saveInterpretation = useCallback(async (text: string) => {
    setSavingInterpretation(true)
    try {
      // Save as vald_interpretation in patient record
      const { error } = await supabase
        .from('patients')
        .update({ vald_interpretation: text })
        .eq('id', patientId)

      if (error) {
        // Column might not exist yet - silently handle
        console.warn('vald_interpretation column may not exist yet:', error.message)
      }
    } catch (err) {
      console.error('Error saving interpretation:', err)
    } finally {
      setSavingInterpretation(false)
    }
  }, [patientId, supabase])

  function debouncedSaveInterpretation(text: string) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveInterpretation(text), 1500)
  }

  function updateInterpretation(text: string) {
    setInterpretation(text)
    debouncedSaveInterpretation(text)
  }

  return (
    <div className="space-y-4">
      <DocumentUploader
        patientId={patientId}
        clinicId={clinicId}
        onUploaded={handleUploaded}
      />
      {documents.length > 0 && (
        <DocumentList documents={documents} onDelete={handleDelete} />
      )}

      {/* Physio interpretation notes - always visible when there are documents */}
      {documents.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowInterpretation(!showInterpretation)}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Interpretación del fisio
              </span>
              {interpretation && !showInterpretation && (
                <span className="text-xs text-amber-600 ml-1">
                  (notas guardadas)
                </span>
              )}
            </div>
            {savingInterpretation && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Guardando...
              </span>
            )}
          </button>

          {showInterpretation && (
            <div className="p-4 space-y-3 bg-white">
              <p className="text-xs text-gray-500">
                Escribe o dicta tu interpretación clínica de los informes VALD. Se incluirá en el informe final generado por IA.
              </p>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Notas de interpretación</label>
                <VoiceDictation
                  currentText={interpretation}
                  onTranscription={(text) => updateInterpretation(text)}
                  placeholder="Dictar interpretación"
                />
              </div>
              <textarea
                value={interpretation}
                onChange={(e) => updateInterpretation(e.target.value)}
                placeholder="Ej: Los datos de fuerza del ForceDecks muestran una asimetría del 15% en cuádriceps a favor del lado izquierdo. El NordBord indica déficit excéntrico bilateral en isquiotibiales..."
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
