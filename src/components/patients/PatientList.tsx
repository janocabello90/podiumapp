'use client'

import Link from 'next/link'
import {
  ChevronRight,
  FileCheck,
  Clock,
  AlertCircle,
  Send,
  Stethoscope,
  FileText,
  CheckCircle2,
  Circle,
} from 'lucide-react'

type Row = {
  id: string
  status: string | null
  created_at?: string
}

type DocRow = {
  id: string
  doc_type?: string | null
  created_at?: string
}

type PatientWithStages = {
  id: string
  full_name: string
  phone?: string | null
  email?: string | null
  anamnesis_forms?: Row[]
  assessments?: Row[]
  documents?: DocRow[]
  reports?: Row[]
}

type Stage = {
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

function computeStage(patient: PatientWithStages): Stage {
  const latestReport = getLatest(patient.reports)
  const latestAssessment = getLatest(patient.assessments)
  const latestAnamnesis = getLatest(patient.anamnesis_forms)
  const hasVald = (patient.documents || []).some((d) => d.doc_type !== 'medical_image')

  // Most advanced stage wins
  if (latestReport?.status === 'approved' || latestReport?.status === 'sent') {
    return {
      key: 'report_approved',
      label: 'Informe aprobado',
      shortLabel: 'Aprobado',
      bg: 'bg-green-50',
      text: 'text-green-700',
      icon: CheckCircle2,
    }
  }

  if (latestReport) {
    return {
      key: 'report_draft',
      label: 'Borrador generado',
      shortLabel: 'Borrador',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      icon: FileText,
    }
  }

  if (latestAssessment?.status === 'completed') {
    return {
      key: 'assessment_done',
      label: hasVald ? 'Listo para informe' : 'Valoración completa',
      shortLabel: 'Valorado',
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      icon: FileCheck,
    }
  }

  if (latestAssessment) {
    return {
      key: 'assessment_progress',
      label: 'Valoración en curso',
      shortLabel: 'Valorando',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      icon: Stethoscope,
    }
  }

  if (latestAnamnesis?.status === 'completed') {
    return {
      key: 'anamnesis_done',
      label: 'Anamnesis completada',
      shortLabel: 'Completada',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      icon: FileCheck,
    }
  }

  if (latestAnamnesis?.status === 'in_progress') {
    return {
      key: 'anamnesis_progress',
      label: 'Anamnesis en progreso',
      shortLabel: 'En progreso',
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      icon: Clock,
    }
  }

  if (latestAnamnesis?.status === 'expired') {
    return {
      key: 'anamnesis_expired',
      label: 'Anamnesis expirada',
      shortLabel: 'Expirada',
      bg: 'bg-red-50',
      text: 'text-red-700',
      icon: AlertCircle,
    }
  }

  if (latestAnamnesis?.status === 'pending') {
    return {
      key: 'anamnesis_pending',
      label: 'Pendiente anamnesis',
      shortLabel: 'Pendiente',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      icon: Send,
    }
  }

  return {
    key: 'new',
    label: 'Nuevo paciente',
    shortLabel: 'Nuevo',
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    icon: Circle,
  }
}

function StageBadge({ stage }: { stage: Stage }) {
  const Icon = stage.icon
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${stage.bg} ${stage.text}`}
    >
      <Icon className="w-3 h-3" />
      <span className="hidden sm:inline">{stage.label}</span>
      <span className="sm:hidden">{stage.shortLabel}</span>
    </span>
  )
}

export default function PatientList({ patients }: { patients: PatientWithStages[] }) {
  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
        <p className="text-gray-500">No hay pacientes todavía</p>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Crear primer paciente
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-100">
        {patients.map((patient) => {
          const stage = computeStage(patient)
          return (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                {/* Avatar */}
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs sm:text-sm font-medium text-blue-700">
                    {patient.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">{patient.full_name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {patient.phone || patient.email || 'Sin contacto'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                <StageBadge stage={stage} />
                <ChevronRight className="w-4 h-4 text-gray-300 hidden sm:block" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
