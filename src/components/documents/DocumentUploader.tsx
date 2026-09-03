'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Document } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

// Lee un error de una respuesta que puede NO ser JSON (p. ej. 413 de la plataforma).
async function readError(res: Response): Promise<string> {
  try {
    const j = await res.clone().json()
    if (j?.error) return j.error
  } catch { /* no era JSON */ }
  if (res.status === 413) return 'El archivo es demasiado grande.'
  const t = await res.text().catch(() => '')
  return t?.trim()?.slice(0, 140) || `Error ${res.status}`
}

interface Props {
  patientId: string
  clinicId: string
  onUploaded: (doc: Document) => void
  onDone?: () => void
  sessionId?: string
}

export default function DocumentUploader({ patientId, clinicId, onUploaded, onDone, sessionId }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Subida DIRECTA a Storage (evita el tope de ~4,5 MB del body de Vercel):
  // 1) pedir signed URL, 2) subir el archivo a Supabase, 3) registrar metadatos.
  async function uploadFile(file: File): Promise<Document> {
    if (file.size > 50 * 1024 * 1024) throw new Error('El archivo supera los 50 MB.')

    const urlRes = await fetch('/api/documents/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, file_name: file.name, session_id: sessionId }),
    })
    if (!urlRes.ok) throw new Error(await readError(urlRes))
    const { path, token } = await urlRes.json()

    const { error: upErr } = await supabase.storage
      .from('documents')
      .uploadToSignedUrl(path, token, file, { contentType: file.type })
    if (upErr) throw new Error(upErr.message || 'Error al subir el archivo')

    const finRes = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storage_path: path,
        file_name: file.name,
        patient_id: patientId,
        doc_type: 'vald_report',
        content_type: file.type,
        ...(sessionId ? { session_id: sessionId } : {}),
      }),
    })
    if (!finRes.ok) throw new Error(await readError(finRes))
    const { document } = await finRes.json()
    return document
  }

  async function handleFiles(files: FileList | File[]) {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf')

    if (pdfFiles.length === 0) {
      toast.error('Solo se permiten archivos PDF')
      return
    }

    setUploading(true)
    setUploadQueue(pdfFiles)

    let successCount = 0
    for (const file of pdfFiles) {
      try {
        const doc = await uploadFile(file)
        onUploaded(doc)
        successCount++
      } catch (err: any) {
        toast.error(`Error con ${file.name}: ${err.message}`)
      }
    }

    setUploading(false)
    setUploadQueue([])

    if (successCount > 0) {
      toast.success(`${successCount} informe${successCount > 1 ? 's' : ''} subido${successCount > 1 ? 's' : ''}`)
      // Re-consulta autoritativa a la BBDD: garantiza que aparezcan TODOS los subidos, sin
      // depender del estado local ni de un refresh del servidor (que podía llegar con lag).
      onDone?.()
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />

      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : uploading
            ? 'border-gray-200 bg-gray-50 cursor-wait'
            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
        }`}
      >
        {uploading ? (
          <div className="space-y-1">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
            <p className="text-xs text-gray-600">
              Subiendo {uploadQueue.length} archivo{uploadQueue.length > 1 ? 's' : ''}...
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="w-6 h-6 text-gray-400 mx-auto" />
            <p className="text-xs text-gray-600">
              Arrastra PDFs o <span className="text-blue-600 font-medium">selecciona</span>
            </p>
            <p className="text-[10px] text-gray-400">Solo PDF · Máx 50MB</p>
          </div>
        )}
      </div>
    </div>
  )
}
