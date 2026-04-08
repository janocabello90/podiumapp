'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, Loader2, X, Eye, Trash2, FileCheck, FileX, Mic, MicOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import type { Document } from '@/types/database'
import VoiceDictation from '@/components/assessment/VoiceDictation'

interface Props {
  patientId: string
  clinicId: string
  initialImages: Document[]
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_SIZE_MB = 20

export default function ImageGallerySection({ patientId, clinicId, initialImages }: Props) {
  const [images, setImages] = useState<Document[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [captionValue, setCaptionValue] = useState('')
  const [savingCaption, setSavingCaption] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Upload a single image file
  async function uploadImage(file: File): Promise<Document> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_id', patientId)
    formData.append('doc_type', 'medical_image')

    const response = await fetch('/api/documents', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Error al subir')
    }

    const { document } = await response.json()
    return document
  }

  async function handleFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: formato no soportado`)
        return false
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name}: demasiado grande (máx ${MAX_SIZE_MB}MB)`)
        return false
      }
      return true
    })

    if (imageFiles.length === 0) return

    setUploading(true)
    let successCount = 0

    for (const file of imageFiles) {
      try {
        const doc = await uploadImage(file)
        // Default: include in report
        const docWithMeta = {
          ...doc,
          extracted_data: { ...doc.extracted_data, include_in_report: true, caption: '' },
        }
        setImages(prev => [docWithMeta, ...prev])
        // Save the include_in_report flag
        await saveImageMeta(doc.id, { include_in_report: true, caption: '' })
        successCount++
      } catch (err: any) {
        toast.error(`Error con ${file.name}: ${err.message}`)
      }
    }

    setUploading(false)
    if (successCount > 0) {
      toast.success(`${successCount} imagen${successCount > 1 ? 'es' : ''} subida${successCount > 1 ? 's' : ''}`)
    }
  }

  // Save metadata (include_in_report, caption) to document
  async function saveImageMeta(docId: string, meta: Record<string, any>) {
    try {
      await fetch(`/api/documents/${docId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: JSON.stringify(meta) }),
      })
    } catch (err) {
      console.error('Error saving image meta:', err)
    }
  }

  // Toggle include in report
  async function toggleIncludeInReport(docId: string) {
    setImages(prev => prev.map(img => {
      if (img.id !== docId) return img
      const currentMeta = parseImageMeta(img)
      const newInclude = !currentMeta.include_in_report
      const newMeta = { ...currentMeta, include_in_report: newInclude }
      saveImageMeta(docId, newMeta)
      return {
        ...img,
        extracted_data: { ...img.extracted_data, ...newMeta },
      }
    }))
  }

  // Parse image metadata from extracted_data
  function parseImageMeta(doc: Document): { include_in_report: boolean; caption: string } {
    const data = doc.extracted_data || {}
    // Try direct fields first
    if (typeof data.include_in_report === 'boolean') {
      return { include_in_report: data.include_in_report, caption: data.caption || '' }
    }
    // Try parsing notes as JSON
    if (data.notes) {
      try {
        const parsed = JSON.parse(data.notes)
        return {
          include_in_report: parsed.include_in_report ?? true,
          caption: parsed.caption || '',
        }
      } catch { /* not JSON */ }
    }
    return { include_in_report: true, caption: '' }
  }

  // Save caption
  async function saveCaption(docId: string) {
    setSavingCaption(true)
    const img = images.find(i => i.id === docId)
    if (!img) return

    const currentMeta = parseImageMeta(img)
    const newMeta = { ...currentMeta, caption: captionValue }

    setImages(prev => prev.map(i =>
      i.id === docId ? { ...i, extracted_data: { ...i.extracted_data, ...newMeta } } : i
    ))
    await saveImageMeta(docId, newMeta)
    setEditingCaption(null)
    setSavingCaption(false)
    toast.success('Descripción guardada')
  }

  // Open preview
  async function openPreview(doc: Document) {
    setLoadingPreview(doc.id)
    try {
      const response = await fetch(`/api/documents?path=${encodeURIComponent(doc.storage_path)}`)
      if (!response.ok) throw new Error('Error al cargar')
      const { url } = await response.json()
      setPreviewUrl(url)
      setPreviewName(doc.file_name)
    } catch (err) {
      toast.error('Error al abrir imagen')
    } finally {
      setLoadingPreview(null)
    }
  }

  // Delete image
  async function handleDelete(docId: string) {
    if (!confirm('¿Eliminar esta imagen?')) return
    setImages(prev => prev.filter(i => i.id !== docId))
    toast.success('Imagen eliminada')
  }

  // Get thumbnail URL (generate signed URL on demand)
  function ThumbnailImage({ doc }: { doc: Document }) {
    const [thumbUrl, setThumbUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const loadThumbnail = useCallback(async () => {
      try {
        const response = await fetch(`/api/documents?path=${encodeURIComponent(doc.storage_path)}`)
        if (!response.ok) throw new Error()
        const { url } = await response.json()
        setThumbUrl(url)
      } catch {
        setThumbUrl(null)
      } finally {
        setLoading(false)
      }
    }, [doc.storage_path])

    // Load thumbnail on mount
    useState(() => { loadThumbnail() })

    if (loading) {
      return (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      )
    }

    if (!thumbUrl) {
      return (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <Camera className="w-5 h-5 text-gray-300" />
        </div>
      )
    }

    return (
      <img
        src={thumbUrl}
        alt={doc.file_name}
        className="w-full h-full object-cover"
      />
    )
  }

  const includedCount = images.filter(img => parseImageMeta(img).include_in_report).length

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />

      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files) }}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-purple-400 bg-purple-50'
            : uploading
            ? 'border-gray-200 bg-gray-50 cursor-wait'
            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
        }`}
      >
        {uploading ? (
          <div className="space-y-1">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto" />
            <p className="text-xs text-gray-600">Subiendo imágenes...</p>
          </div>
        ) : (
          <div className="space-y-1">
            <Camera className="w-6 h-6 text-gray-400 mx-auto" />
            <p className="text-xs text-gray-600">
              Arrastra imágenes o <span className="text-purple-600 font-medium">selecciona</span>
            </p>
            <p className="text-[10px] text-gray-400">JPG, PNG, WebP · Máx {MAX_SIZE_MB}MB</p>
          </div>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <>
          <p className="text-xs text-gray-500">
            {includedCount} de {images.length} imagen{images.length > 1 ? 'es' : ''} seleccionada{includedCount > 1 ? 's' : ''} para el informe
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => {
              const meta = parseImageMeta(img)
              return (
                <div
                  key={img.id}
                  className={`relative group rounded-xl border-2 overflow-hidden transition-all ${
                    meta.include_in_report
                      ? 'border-green-400 shadow-sm'
                      : 'border-gray-200 opacity-60'
                  }`}
                >
                  {/* Thumbnail */}
                  <div
                    className="aspect-square cursor-pointer"
                    onClick={() => openPreview(img)}
                  >
                    <ThumbnailImage doc={img} />
                    {loadingPreview === img.id && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Include/exclude badge */}
                  <button
                    onClick={() => toggleIncludeInReport(img.id)}
                    className={`absolute top-2 left-2 p-1.5 rounded-lg shadow-md transition-colors ${
                      meta.include_in_report
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-white text-gray-400 hover:bg-gray-100'
                    }`}
                    title={meta.include_in_report ? 'Incluida en el informe — clic para excluir' : 'Excluida del informe — clic para incluir'}
                  >
                    {meta.include_in_report ? (
                      <FileCheck className="w-3.5 h-3.5" />
                    ) : (
                      <FileX className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Footer with filename and caption */}
                  <div className="p-2 bg-white">
                    <p className="text-[10px] text-gray-500 truncate">{img.file_name}</p>
                    {editingCaption === img.id ? (
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={captionValue}
                            onChange={(e) => setCaptionValue(e.target.value)}
                            placeholder="Descripción..."
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveCaption(img.id)
                              if (e.key === 'Escape') setEditingCaption(null)
                            }}
                          />
                          <button
                            onClick={() => saveCaption(img.id)}
                            disabled={savingCaption}
                            className="px-2 py-1 text-[10px] bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                          >
                            OK
                          </button>
                        </div>
                        <VoiceDictation
                          currentText={captionValue}
                          onTranscription={(text) => setCaptionValue(text)}
                          placeholder="Dictar descripción"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingCaption(img.id)
                          setCaptionValue(meta.caption)
                        }}
                        className="mt-0.5 text-[10px] text-purple-500 hover:text-purple-700 font-medium"
                      >
                        {meta.caption || '+ Añadir descripción'}
                      </button>
                    )}
                    {meta.caption && editingCaption !== img.id && (
                      <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{meta.caption}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Image Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => { setPreviewUrl(null); setPreviewName('') }}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewUrl}
              alt={previewName}
              className="w-full h-full object-contain rounded-xl"
            />
            <p className="text-center text-sm text-white/70 mt-2">{previewName}</p>
          </div>
        </div>
      )}
    </div>
  )
}
