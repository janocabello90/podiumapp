'use client'

import Link from 'next/link'
import { ChevronRight, FileCheck, Clock, AlertCircle } from 'lucide-react'
import type { Patient, AnamnesisForm } from '@/types/database'

type PatientWithAnamnesis = Patient & {
  anamnesis_forms: Pick<AnamnesisForm, 'id' | 'status'>[]
}

function getAnamnesisStatus(forms: Pick<AnamnesisForm, 'id' | 'status'>[]) {
  if (!forms || forms.length === 0) return null
  const latest = forms[0]
  return latest.status
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500">
        Sin anamnesis
      </span>
    )
  }

  const styles: Record<string, { bg: string; text: string; icon: typeof FileCheck }> = {
    completed: { bg: 'bg-green-50', text: 'text-green-700', icon: FileCheck },
    in_progress: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock },
    pending: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock },
    expired: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle },
  }

  const labels: Record<string, string> = {
    completed: 'Anamnesis completa',
    in_progress: 'En progreso',
    pending: 'Pendiente',
    expired: 'Expirada',
  }

  const style = styles[status] || styles.pending
  const Icon = style.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
      <Icon className="w-3 h-3" />
      {labels[status] || status}
    </span>
  )
}

export default function PatientList({ patients }: { patients: PatientWithAnamnesis[] }) {
  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
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
        {patients.map((patient) => (
          <Link
            key={patient.id}
            href={`/patients/${patient.id}`}
            className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-700">
                  {patient.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-900">{patient.full_name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {patient.phone || patient.email || 'Sin contacto'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge status={getAnamnesisStatus(patient.anamnesis_forms)} />
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
