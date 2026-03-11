'use client'

import { useState } from 'react'
import { FileText, Eye, X, MessageSquare, Trash2, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Document } from '@/types/database'

interface Props {
  documents: Document[]
  onDelete: (id: string) => void
}

export default function DocumentList({ documents, onDelete }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string>('')
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState<string>('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [localDocs, setLocalDocs] = useState<Document[]>(documents)

  async function openPreview(doc: Document) {
    setLoadingPreview(doc.id)
    try {
      const response = await fetch(`/api/documents?path=${encodeURIComponent(doc.storage_path)}`)
      if (!response.ok) throw new Error('Error al cargar')
      const { url } = await response.json()
      setPreviewUrl(url)
      setPreviewName(doc.file_name)
    } catch (err) {
      toast.error('Error al abrir el documento')
    } finally {
      setLoadingPreview(null)
    }
  }

  function startEditNotes(doc: Document) {
    setEditingNotes(doc.id)
    setNotesValue(doc.extracted_data?.notes || '')
  }

  async function saveNotes(docId: string) {
    setSavingNotes(true)
    try {
      const response = await fetch(`/api/documents/${docId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue }),
      })
      if (!response.ok) throw new Error('Error al guardar')

      // Update local state
      setLocalDocs(prev => prev.map(d =>
        d.id === docId ? { ...d, extracted_data: { ...d.extracted_data, notes: notesValue } } : d
      ))
      setEditingNotes(null)
      toast.success('Notas guardadas')
    } catch (err) {
      toast.error('Error al guardar notas')
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('¿Eliminar este documento?')) return
    try {
      // We'll just hide it locally - actual delete would need another API endpoint
      setLocalDocs(prev => prev.filter(d => d.id !== docId))
      onDelete(docId)
      toast.success('Documento eliminado')
    } catch (err) {
      toast.error('Error al eliminar')
    }
  }

  if (localDocs.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        No hay informes subidos todavía
      </p>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {localDocs.map((doc) => (
          <div key={doc.id} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(doc.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openPreview(doc)}
                  disabled={loadingPreview === doc.id}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Previsualizar"
                >
                  {loadingPreview === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => startEditNotes(doc)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    doc.extracted_data?.notes
                      ? 'text-blue-500 hover:bg-blue-50'
                      : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  title="Notas"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notes display */}
            {doc.extracted_data?.notes && editingNotes !== doc.id && (
              <p className="mt-2 text-xs text-gray-500 italic pl-12">
                {doc.extracted_data.notes}
              </p>
            )}

            {/* Notes editor */}
            {editingNotes === doc.id && (
              <div className="mt-3 pl-12 space-y-2">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Notas sobre este informe..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveNotes(doc.id)}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditingNotes(null)}
                    className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 truncate">{previewName}</h3>
              <button
                onClick={() => { setPreviewUrl(null); setPreviewName('') }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 p-2">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-lg border border-gray-200"
                title={previewName}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
