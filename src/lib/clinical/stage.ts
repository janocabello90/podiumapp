import {
  FileCheck,
  Clock,
  AlertCircle,
  Send,
  Stethoscope,
  FileText,
  CheckCircle2,
  Circle,
} from 'lucide-react'

type Row = { id: string; status: string | null; created_at?: string }
type DocRow = { id: string; doc_type?: string | null; created_at?: string }

export type PatientStageInput = {
  id: string
  anamnesis_forms?: Row[]
  assessments?: Row[]
  documents?: DocRow[]
  reports?: Row[]
}

export type Stage = {
  key: string
  label: string
  shortLabel: string
  bg: string
  text: string
  icon: typeof FileCheck
}

function getLatest<T extends { created_at?: string }>(rows: T[] | undefined): T | null {
  if (!rows || rows.length === 0) return null
  return [...rows].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0
    const db = b.created_at ? new Date(b.created_at).getTime() : 0
    return db - da
  })[0]
}

export function computeStage(patient: PatientStageInput): Stage {
  const latestReport = getLatest(patient.reports)
  const latestAssessment = getLatest(patient.assessments)
  const latestAnamnesis = getLatest(patient.anamnesis_forms)
  const hasVald = (patient.documents || []).some((d) => d.doc_type !== 'medical_image')

  if (latestReport?.status === 'approved' || latestReport?.status === 'sent') {
    return { key: 'report_approved', label: 'Informe aprobado', shortLabel: 'Aprobado',
             bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 }
  }
  if (latestReport) {
    return { key: 'report_draft', label: 'Borrador generado', shortLabel: 'Borrador',
             bg: 'bg-amber-50', text: 'text-amber-700', icon: FileText }
  }
  if (latestAssessment?.status === 'completed') {
    return { key: 'assessment_done', label: hasVald ? 'Listo para informe' : 'Valoración completa',
             shortLabel: 'Valorado', bg: 'bg-teal-50', text: 'text-teal-700', icon: FileCheck }
  }
  if (latestAssessment) {
    return { key: 'assessment_progress', label: 'Valoración en curso', shortLabel: 'Valorando',
             bg: 'bg-blue-50', text: 'text-blue-700', icon: Stethoscope }
  }
  if (latestAnamnesis?.status === 'completed') {
    return { key: 'anamnesis_done', label: 'Anamnesis completada', shortLabel: 'Completada',
             bg: 'bg-emerald-50', text: 'text-emerald-700', icon: FileCheck }
  }
  if (latestAnamnesis?.status === 'in_progress') {
    return { key: 'anamnesis_progress', label: 'Anamnesis en progreso', shortLabel: 'En progreso',
             bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock }
  }
  if (latestAnamnesis?.status === 'expired') {
    return { key: 'anamnesis_expired', label: 'Anamnesis expirada', shortLabel: 'Expirada',
             bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle }
  }
  if (latestAnamnesis?.status === 'pending') {
    return { key: 'anamnesis_pending', label: 'Pendiente anamnesis', shortLabel: 'Pendiente',
             bg: 'bg-blue-50', text: 'text-blue-700', icon: Send }
  }
  return { key: 'new', label: 'Nuevo paciente', shortLabel: 'Nuevo',
           bg: 'bg-gray-100', text: 'text-gray-500', icon: Circle }
}
