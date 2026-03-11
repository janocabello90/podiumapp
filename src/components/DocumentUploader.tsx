'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Document } from '@/types/database'

interface Props {
  patientId: string
  clinicId: string
  onUploaded: (doc: Document) => void
}

export default function DocumentUploader({ patientId, clinicId, onUploaded }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File): Promise<Document> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_id', patientId)
    formData.append('doc_type', 'vald_report')

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
