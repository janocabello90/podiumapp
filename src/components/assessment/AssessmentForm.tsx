'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { BODY_REGIONS, getRegionById } from './assessmentFields'
import type { AssessmentSection, AssessmentField, AssessmentTest } from './assessmentFields'
import VoiceDictation from './VoiceDictation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  Loader2,
  MessageSquare,
  Mic,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
} from 'lucide-react'

interface Props {
  assessmentId: string
  patientId: string
  initialData: Record<string, any>
  initialStatus: string
  // Reutilizable: por defecto escribe en `assessments.assessment_data` (flujo antiguo);
  // el flujo de sesión pasa table='sessions' y dataColumn='clinical_data'.
  table?: string
  dataColumn?: string
}

const REGION_IDS = BODY_REGIONS.map((r) => r.id)

// Deriva las regiones ya presentes en una valoración. Prioriza `_regions` (nuevo, multi-región);
// si no, cae a `_region` (dato antiguo de una sola región) y a inferirlas de las claves guardadas
// (formato `${regionId}_${sectionId}_...`). Así los datos previos siguen apareciendo.
function inferInitialRegions(data: Record<string, any>): string[] {
  if (Array.isArray(data._regions) && data._regions.length) {
    return data._regions.filter((id: string) => REGION_IDS.includes(id))
  }
  const set = new Set<string>()
  if (typeof data._region === 'string' && data._region) set.add(data._region)
  for (const key of Object.keys(data)) {
    if (key.startsWith('_')) continue
    const r = BODY_REGIONS.find((reg) => key.startsWith(reg.id + '_'))
    if (r) set.add(r.id)
  }
  return Array.from(set)
}

export default function AssessmentForm({
  assessmentId,
  patientId,
  initialData,
  initialStatus,
  table = 'assessments',
  dataColumn = 'assessment_data',
}: Props) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData)
  const [activeRegions, setActiveRegions] = useState<string[]>(() => inferInitialRegions(initialData))
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(initialStatus)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  const region = selectedRegion ? getRegionById(selectedRegion) : null

  // Auto-save
  const saveToSupabase = useCallback(async (data: Record<string, any>) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from(table)
        .update({ [dataColumn]: data, status: 'in_progress' })
        .eq('id', assessmentId)
      if (error) throw error
    } catch (err: any) {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [assessmentId, supabase, table, dataColumn])

  function debouncedSave(data: Record<string, any>) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveToSupabase(data), 1500)
  }

  // Guardado inmediato (cambios estructurales: añadir/quitar región)
  function saveNow(data: Record<string, any>) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveToSupabase(data)
  }

  function updateField(sectionId: string, key: string, value: any) {
    const fullKey = `${selectedRegion}_${sectionId}_${key}`
    const updated = { ...formData, [fullKey]: value }
    setFormData(updated)
    debouncedSave(updated)
  }

  function updateNotes(sectionId: string, value: string) {
    const fullKey = `${selectedRegion}_${sectionId}_notes`
    const updated = { ...formData, [fullKey]: value }
    setFormData(updated)
    debouncedSave(updated)
  }

  function updateTestResult(sectionId: string, testKey: string, result: string) {
    const fullKey = `${selectedRegion}_${sectionId}_test_${testKey}`
    const updated = { ...formData, [fullKey]: result }
    setFormData(updated)
    debouncedSave(updated)
  }

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openRegion(id: string) {
    setSelectedRegion(id)
    const reg = getRegionById(id)
    if (reg && reg.sections.length > 0) setExpandedSections(new Set([reg.sections[0].id]))
  }

  function addRegion(id: string) {
    const nextRegions = activeRegions.includes(id) ? activeRegions : [...activeRegions, id]
    const updated = { ...formData, _regions: nextRegions }
    setActiveRegions(nextRegions)
    setFormData(updated)
    saveNow(updated)
    setPickerOpen(false)
    openRegion(id)
  }

  function removeRegion(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('¿Quitar esta región y sus datos de la exploración?')) return
    const nextRegions = activeRegions.filter((r) => r !== id)
    const updated: Record<string, any> = { _regions: nextRegions }
    for (const [k, v] of Object.entries(formData)) {
      if (k === '_regions' || k === '_region') continue
      if (k.startsWith(id + '_')) continue // descartar los datos de esta región
      updated[k] = v
    }
    setActiveRegions(nextRegions)
    setFormData(updated)
    saveNow(updated)
    if (selectedRegion === id) setSelectedRegion(null)
  }

  function regionProgress(id: string) {
    const reg = getRegionById(id)
    if (!reg) return { filled: 0, total: 0 }
    let filled = 0
    let total = 0
    for (const s of reg.sections) {
      for (const f of s.fields) {
        total++
        const val = formData[`${id}_${s.id}_${f.key}`]
        if (val !== undefined && val !== '' && val !== null && !(Array.isArray(val) && val.length === 0)) filled++
      }
      for (const t of s.tests || []) {
        total++
        if (formData[`${id}_${s.id}_test_${t.key}`] !== undefined) filled++
      }
    }
    return { filled, total }
  }

  async function completeAssessment() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from(table)
        .update({ [dataColumn]: formData, status: 'completed' })
        .eq('id', assessmentId)
      if (error) throw error
      setStatus('completed')
      toast.success('Valoración completada y guardada')
      // Fire-and-forget: auto-classify patient from anamnesis + assessment
      if (patientId) {
        fetch('/api/patients/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId }),
        }).catch(() => {})
      }
    } catch (err: any) {
      toast.error('Error al completar la valoración')
    } finally {
      setSaving(false)
    }
  }

  // ===== Pantalla de resumen (varias regiones) / selección =====
  if (!selectedRegion) {
    const remaining = BODY_REGIONS.filter((r) => !activeRegions.includes(r.id))
    const showPicker = pickerOpen || activeRegions.length === 0

    return (
      <div className="space-y-4">
        {/* Regiones ya añadidas */}
        {activeRegions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">Regiones a valorar</h2>
              {status === 'completed' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                  <Check className="w-3 h-3" /> Completada
                </span>
              ) : (
                <button
                  onClick={completeAssessment}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Completar valoración
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeRegions.map((id) => {
                const reg = getRegionById(id)
                if (!reg) return null
                const { filled, total } = regionProgress(id)
                return (
                  <div key={id} className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
                    <button onClick={() => openRegion(id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <span className="text-2xl">{reg.icon}</span>
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-900 truncate">{reg.label}</span>
                        <span className="block text-xs text-gray-400 tabular-nums">{filled}/{total} campos</span>
                      </span>
                    </button>
                    {status !== 'completed' && (
                      <button onClick={() => removeRegion(id)} title="Quitar región" className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openRegion(id)} title="Abrir" className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>

            {!showPicker && remaining.length > 0 && status !== 'completed' && (
              <button
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600 text-sm font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" /> Añadir otra región
              </button>
            )}
          </div>
        )}

        {/* Selector de región */}
        {showPicker && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {activeRegions.length > 0 ? 'Añadir región' : 'Selecciona la región a valorar'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">Elige la estructura corporal del paciente. Puedes valorar varias zonas.</p>

            {remaining.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {remaining.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addRegion(r.id)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <span className="text-2xl">{r.icon}</span>
                    <span className="font-medium text-gray-900">{r.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Ya has añadido todas las regiones disponibles.</p>
            )}

            {activeRegions.length > 0 && (
              <button onClick={() => setPickerOpen(false)} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!region) return null

  // ===== Editor de una región =====
  return (
    <div className="space-y-4">
      {/* Region header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedRegion(null)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Volver a regiones
          </button>
          <span className="text-2xl">{region.icon}</span>
          <h2 className="text-lg font-semibold text-gray-900">{region.label}</h2>
          {saving && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Guardando...
            </span>
          )}
        </div>
        {status === 'completed' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
            <Check className="w-3 h-3" />
            Completada
          </span>
        )}
      </div>

      {/* Sections */}
      {region.sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          regionId={region.id}
          formData={formData}
          isExpanded={expandedSections.has(section.id)}
          onToggle={() => toggleSection(section.id)}
          onUpdateField={(key, value) => updateField(section.id, key, value)}
          onUpdateNotes={(value) => updateNotes(section.id, value)}
          onUpdateTest={(testKey, result) => updateTestResult(section.id, testKey, result)}
        />
      ))}

      {/* Volver al resumen (los datos se autoguardan) */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => setSelectedRegion(null)}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Check className="w-4 h-4" />
          Hecho — volver a regiones
        </button>
      </div>
    </div>
  )
}

// ============================================
// Section Card Component
// ============================================
function SectionCard({
  section,
  regionId,
  formData,
  isExpanded,
  onToggle,
  onUpdateField,
  onUpdateNotes,
  onUpdateTest,
}: {
  section: AssessmentSection
  regionId: string
  formData: Record<string, any>
  isExpanded: boolean
  onToggle: () => void
  onUpdateField: (key: string, value: any) => void
  onUpdateNotes: (value: string) => void
  onUpdateTest: (testKey: string, result: string) => void
}) {
  const notesKey = `${regionId}_${section.id}_notes`
  const notesValue = formData[notesKey] || ''

  // Count filled fields
  const filledCount = section.fields.filter(f => {
    const key = `${regionId}_${section.id}_${f.key}`
    return formData[key] !== undefined && formData[key] !== '' && formData[key] !== null
  }).length + (section.tests?.filter(t => {
    const key = `${regionId}_${section.id}_test_${t.key}`
    return formData[key] !== undefined
  }).length || 0)

  const totalCount = section.fields.length + (section.tests?.length || 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">{section.title}</h3>
          {filledCount > 0 && (
            <span className="text-xs text-gray-400">{filledCount}/{totalCount}</span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          {section.description && (
            <p className="text-xs text-gray-400">{section.description}</p>
          )}

          {/* Structured fields */}
          {section.fields.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={formData[`${regionId}_${section.id}_${field.key}`]}
                  onChange={(val) => onUpdateField(field.key, val)}
                />
              ))}
            </div>
          )}

          {/* Orthopedic tests */}
          {section.tests && section.tests.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Tests</h4>
              <div className="grid grid-cols-1 gap-2">
                {section.tests.map((test) => (
                  <TestInput
                    key={test.key}
                    test={test}
                    value={formData[`${regionId}_${section.id}_test_${test.key}`]}
                    onChange={(result) => onUpdateTest(test.key, result)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Notes with voice dictation */}
          {section.hasNotes && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Notas clínicas
                </label>
                <VoiceDictation
                  currentText={notesValue}
                  onTranscription={(text) => onUpdateNotes(text)}
                  placeholder="Dictar observaciones"
                />
              </div>
              <textarea
                value={notesValue}
                onChange={(e) => onUpdateNotes(e.target.value)}
                placeholder="Observaciones del fisio..."
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Field Input Component
// ============================================
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: AssessmentField
  value: any
  onChange: (val: any) => void
}) {
  switch (field.type) {
    case 'select':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Seleccionar...</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )

    case 'multiselect':
      const selected: string[] = value || []
      return (
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
          <div className="flex flex-wrap gap-2">
            {field.options?.map(opt => (
              <button
                key={opt}
                onClick={() => {
                  const newVal = selected.includes(opt)
                    ? selected.filter(s => s !== opt)
                    : [...selected, opt]
                  onChange(newVal)
                }}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  selected.includes(opt)
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )

    case 'boolean':
      return (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-500">{field.label}</label>
          <div className="flex gap-2">
            <button
              onClick={() => onChange(true)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                value === true ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              Sí
            </button>
            <button
              onClick={() => onChange(false)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                value === false ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              No
            </button>
          </div>
        </div>
      )

    case 'scale':
      return (
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {field.label} {field.description && <span className="text-gray-400 font-normal">— {field.description}</span>}
          </label>
          <div className="flex items-center gap-1">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => onChange(i)}
                className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                  value === i
                    ? i <= 3 ? 'bg-green-500 text-white border-green-500'
                      : i <= 6 ? 'bg-yellow-500 text-white border-yellow-500'
                      : 'bg-red-500 text-white border-red-500'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      )

    case 'number':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={field.placeholder}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )

    case 'textarea':
      return (
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
          />
        </div>
      )

    default:
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )
  }
}

// ============================================
// Test Input Component (Positive/Negative/Not tested)
// ============================================
function TestInput({
  test,
  value,
  onChange,
}: {
  test: AssessmentTest
  value: string | undefined
  onChange: (result: string) => void
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
      <div>
        <span className="text-sm font-medium text-gray-800">{test.label}</span>
        {test.description && (
          <span className="text-xs text-gray-400 ml-2">{test.description}</span>
        )}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => onChange('positive')}
          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
            value === 'positive'
              ? 'bg-red-100 border-red-300 text-red-700 font-medium'
              : 'border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          +
        </button>
        <button
          onClick={() => onChange('negative')}
          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
            value === 'negative'
              ? 'bg-green-100 border-green-300 text-green-700 font-medium'
              : 'border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          −
        </button>
        <button
          onClick={() => onChange('not_tested')}
          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
            value === 'not_tested'
              ? 'bg-gray-200 border-gray-300 text-gray-600 font-medium'
              : 'border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          N/A
        </button>
      </div>
    </div>
  )
}
