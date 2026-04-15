'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { computeStage, type Stage, type PatientStageInput } from '@/lib/clinical/stage'
import { getRegionLabel, getPathologyLabel, getActivityLabel } from '@/lib/clinical/taxonomy'

type PatientWithStages = PatientStageInput & {
  full_name: string
  phone?: string | null
  email?: string | null
  date_of_birth?: string | null
  body_region?: string | null
  pathology_tag?: string | null
  pathology_label?: string | null
  activity_level?: string | null
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

function computeAge(dob?: string | null): number | null {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

export default function PatientList({ patients }: { patients: PatientWithStages[] }) {
  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
        <p className="text-gray-500">No hay pacientes que coincidan con los filtros</p>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Crear paciente
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-100">
        {patients.map((patient) => {
          const stage = computeStage(patient)
          const age = computeAge(patient.date_of_birth)
          const regionLabel = getRegionLabel(patient.body_region)
          const pathologyLabel = patient.pathology_label || getPathologyLabel(patient.pathology_tag)
          const activityLabel = getActivityLabel(patient.activity_level)

          const clinicalLine = [regionLabel, pathologyLabel].filter(Boolean).join(' · ')
          const metaLine = [
            age !== null ? `${age} años` : null,
            activityLabel,
          ]
            .filter(Boolean)
            .join(' · ')

          return (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
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

                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">{patient.full_name}</h3>
                  {clinicalLine ? (
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{clinicalLine}</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {patient.phone || patient.email || 'Sin contacto'}
                    </p>
                  )}
                  {metaLine && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{metaLine}</p>
                  )}
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
