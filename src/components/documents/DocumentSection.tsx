'use client'

import { useState } from 'react'
import type { Document } from '@/types/database'
import DocumentUploader from './DocumentUploader'
import DocumentList from './DocumentList'

interface Props {
  patientId: string
  clinicId: string
  initialDocuments: Document[]
}

export default function DocumentSection({ patientId, clinicId, initialDocuments }: Props) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)

  function handleUploaded(doc: Document) {
    setDocuments(prev => [doc, ...prev])
  }

  function handleDelete(docId: string) {
    setDocuments(prev => prev.filter(d => d.id !== docId))
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
    </div>
  )
}
