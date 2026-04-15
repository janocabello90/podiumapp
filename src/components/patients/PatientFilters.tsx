'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { X, Filter as FilterIcon } from 'lucide-react'
import { BODY_REGIONS, ACTIVITY_LEVELS, PATHOLOGIES } from '@/lib/clinical/taxonomy'

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'anamnesis_pending', label: 'Pendiente anamnesis' },
  { value: 'anamnesis_progress', label: 'Anamnesis en progreso' },
  { value: 'anamnesis_done', label: 'Anamnesis completada' },
  { value: 'assessment_progress', label: 'Valoración en curso' },
  { value: 'assessment_done', label: 'Valoración completa' },
  { value: 'report_draft', label: 'Borrador de informe' },
  { value: 'report_approved', label: 'Informe aprobado' },
]

const AGE_RANGES: { value: string; label: string }[] = [
  { value: '0-17', label: '<18 años' },
  { value: '18-35', label: '18-35' },
  { value: '36-55', label: '36-55' },
  { value: '56-70', label: '56-70' },
  { value: '71-120', label: '>70' },
]

export default function PatientFilters({ totalCount }: { totalCount: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const current = {
    q: searchParams.get('q') || '',
    region: searchParams.get('region') || '',
    pathology: searchParams.get('pathology') || '',
    activity: searchParams.get('activity') || '',
    age: searchParams.get('age') || '',
    gender: searchParams.get('gender') || '',
    stage: searchParams.get('stage') || '',
  }

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (!value) sp.delete(key)
    else sp.set(key, value)
    // Reset pathology when region changes
    if (key === 'region') sp.delete('pathology')
    startTransition(() => {
      router.push(`/patients?${sp.toString()}`)
    })
  }

  function clearAll() {
    startTransition(() => {
      router.push('/patients')
    })
  }

  const activeCount = [
    current.region,
    current.pathology,
    current.activity,
    current.age,
    current.gender,
    current.stage,
  ].filter(Boolean).length

  const pathologiesForRegion = current.region
    ? PATHOLOGIES.filter((p) => p.region === current.region || p.region === 'multiple' || p.region === 'otro')
    : PATHOLOGIES

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FilterIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtros</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{totalCount} resultado{totalCount !== 1 ? 's' : ''}</span>
          {activeCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearAll()
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Limpiar
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Stage */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              value={current.stage}
              onChange={(e) => updateParam('stage', e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            >
              <option value="">Todos</option>
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Body region */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Región</label>
            <select
              value={current.region}
              onChange={(e) => updateParam('region', e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            >
              <option value="">Todas</option>
              {BODY_REGIONS.map((r) => (
                <option key={r.slug} value={r.slug}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Pathology */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Patología</label>
            <select
              value={current.pathology}
              onChange={(e) => updateParam('pathology', e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            >
              <option value="">Todas</option>
              {pathologiesForRegion.map((p) => (
                <option key={p.slug} value={p.slug}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Activity */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Actividad</label>
            <select
              value={current.activity}
              onChange={(e) => updateParam('activity', e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            >
              <option value="">Todas</option>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.slug} value={a.slug}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Edad</label>
            <select
              value={current.age}
              onChange={(e) => updateParam('age', e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            >
              <option value="">Todas</option>
              {AGE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sexo</label>
            <select
              value={current.gender}
              onChange={(e) => updateParam('gender', e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            >
              <option value="">Todos</option>
              <option value="male">Hombre</option>
              <option value="female">Mujer</option>
              <option value="other">Otro</option>
            </select>
          </div>
        </div>
      )}

      {/* Active chips (visible when collapsed) */}
      {!open && activeCount > 0 && (
        <div className="border-t border-gray-100 px-4 sm:px-5 py-2.5 flex flex-wrap gap-1.5">
          {current.stage && (
            <Chip label={STAGE_OPTIONS.find((o) => o.value === current.stage)?.label || current.stage} onClear={() => updateParam('stage', '')} />
          )}
          {current.region && (
            <Chip label={BODY_REGIONS.find((r) => r.slug === current.region)?.label || current.region} onClear={() => updateParam('region', '')} />
          )}
          {current.pathology && (
            <Chip label={PATHOLOGIES.find((p) => p.slug === current.pathology)?.label || current.pathology} onClear={() => updateParam('pathology', '')} />
          )}
          {current.activity && (
            <Chip label={ACTIVITY_LEVELS.find((a) => a.slug === current.activity)?.label || current.activity} onClear={() => updateParam('activity', '')} />
          )}
          {current.age && <Chip label={AGE_RANGES.find((r) => r.value === current.age)?.label || current.age} onClear={() => updateParam('age', '')} />}
          {current.gender && (
            <Chip
              label={current.gender === 'male' ? 'Hombre' : current.gender === 'female' ? 'Mujer' : 'Otro'}
              onClear={() => updateParam('gender', '')}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-full transition-colors"
    >
      {label}
      <X className="w-3 h-3" />
    </button>
  )
}
