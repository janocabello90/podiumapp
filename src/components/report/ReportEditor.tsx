'use client'

import { useState, useCallback, useRef } from 'react'
import { Loader2, FileText, Download, Save, CheckCircle, Edit3, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface ReportData {
  portada_intro: string
  resumen_anamnesis: string
  exploracion_fisica: {
    introduccion: string
    exploracion_visual: string
    palpacion: string
    sensibilidad: string
    movilidad: string
    tests_ortopedicos: string
    fuerza: string
    hallazgos: string
  }
  conclusiones: string
  descargo: string
}

interface Props {
  reportId: string
  patientName: string
  patientDob: string | null
  patientGender: string | null
  initialData: ReportData
  initialStatus: string
}

const SECTION_LABELS: Record<string, string> = {
  portada_intro: 'Introducción',
  resumen_anamnesis: 'Resumen de la Anamnesis',
  'exploracion_fisica.introduccion': 'Exploración Física - Introducción',
  'exploracion_fisica.exploracion_visual': 'Exploración Visual',
  'exploracion_fisica.palpacion': 'Palpación',
  'exploracion_fisica.sensibilidad': 'Sensibilidad',
  'exploracion_fisica.movilidad': 'Movilidad',
  'exploracion_fisica.tests_ortopedicos': 'Tests Ortopédicos',
  'exploracion_fisica.fuerza': 'Fuerza',
  'exploracion_fisica.hallazgos': 'Hallazgos',
  conclusiones: 'Conclusiones Finales',
  descargo: 'Descargo de responsabilidad',
}

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((o, k) => o?.[k], obj) || ''
}

function setNestedValue(obj: any, path: string, value: string): any {
  const clone = JSON.parse(JSON.stringify(obj))
  const keys = path.split('.')
  let current = clone
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]]
  }
  current[keys[keys.length - 1]] = value
  return clone
}

export default function ReportEditor({ reportId, patientName, patientDob, patientGender, initialData, initialStatus }: Props) {
  const [reportData, setReportData] = useState<ReportData>(initialData)
  const [status, setStatus] = useState(initialStatus)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const saveTimeout = useRef<NodeJS.Timeout>()

  const debouncedSave = useCallback((data: ReportData) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch(`/api/reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_data: data }),
        })
      } catch {
        toast.error('Error al guardar')
      }
      setSaving(false)
    }, 1500)
  }, [reportId])

  function startEditing(sectionKey: string) {
    setEditingSection(sectionKey)
    setEditValue(getNestedValue(reportData, sectionKey))
  }

  function saveSection() {
    if (!editingSection) return
    const updated = setNestedValue(reportData, editingSection, editValue)
    setReportData(updated)
    setEditingSection(null)
    debouncedSave(updated)
    toast.success('Sección actualizada')
  }

  async function approveReport() {
    setSaving(true)
    try {
      await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', report_data: reportData }),
      })
      setStatus('approved')
      toast.success('Informe aprobado')
    } catch {
      toast.error('Error al aprobar')
    }
    setSaving(false)
  }

  async function exportPDF() {
    setExporting(true)
    try {
      const response = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          reportData,
          patientName,
          patientDob,
          patientGender,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error al exportar')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Informe_PODIUM_${patientName.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF descargado')
    } catch (err: any) {
      toast.error(err.message || 'Error al exportar PDF')
    }
    setExporting(false)
  }

  const age = patientDob
    ? Math.floor((Date.now() - new Date(patientDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const sectionKeys = [
    'portada_intro',
    'resumen_anamnesis',
    'exploracion_fisica.introduccion',
    'exploracion_fisica.exploracion_visual',
    'exploracion_fisica.palpacion',
    'exploracion_fisica.sensibilidad',
    'exploracion_fisica.movilidad',
    'exploracion_fisica.tests_ortopedicos',
    'exploracion_fisica.fuerza',
    'exploracion_fisica.hallazgos',
    'conclusiones',
    'descargo',
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {viewMode === 'edit' ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {viewMode === 'edit' ? 'Vista previa' : 'Modo edición'}
          </button>
          {saving && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Guardando...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <button
              onClick={approveReport}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex-1 sm:flex-none justify-center"
            >
              <CheckCircle className="w-4 h-4" />
              Aprobar
            </button>
          )}
          <button
            onClick={exportPDF}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex-1 sm:flex-none justify-center"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </button>
        </div>
      </div>

      {status === 'approved' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Informe aprobado. Puedes seguir editando o exportar a PDF.
        </div>
      )}

      {/* Report content */}
      {viewMode === 'preview' ? (
        <PreviewMode
          reportData={reportData}
          patientName={patientName}
          patientDob={patientDob}
          patientGender={patientGender}
          age={age}
        />
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* Patient header */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-sm sm:text-lg font-bold text-gray-900 mb-1">INFORME VALORACIÓN INTEGRAL AVANZADA PODIUM</h2>
            <div className="text-xs sm:text-sm text-gray-600 space-y-0.5">
              <p><span className="font-medium">Nombre:</span> {patientName}</p>
              {patientDob && <p><span className="font-medium">Fecha de nacimiento:</span> {patientDob} {age ? `(${age} años)` : ''}</p>}
              {patientGender && <p><span className="font-medium">Sexo:</span> {patientGender === 'male' ? 'Hombre' : patientGender === 'female' ? 'Mujer' : 'Otro'}</p>}
            </div>
          </div>

          {/* Editable sections */}
          {sectionKeys.map((key) => {
            const value = getNestedValue(reportData, key)
            const isEditing = editingSection === key
            const label = SECTION_LABELS[key] || key

            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
                <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{label}</h3>
                  {!isEditing && (
                    <button
                      onClick={() => startEditing(key)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 flex-shrink-0"
                    >
                      <Edit3 className="w-3 h-3" />
                      Editar
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={Math.max(6, editValue.split('\n').length + 2)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveSection}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingSection(null)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {value || <span className="text-gray-400 italic">Sin contenido</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Preview mode
function PreviewMode({ reportData, patientName, patientDob, patientGender, age }: {
  reportData: ReportData
  patientName: string
  patientDob: string | null
  patientGender: string | null
  age: number | null
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-8 max-w-3xl mx-auto space-y-6 sm:space-y-8">
      {/* Title */}
      <div className="text-center border-b border-gray-200 pb-4 sm:pb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-wide mb-3 sm:mb-4">PODIUM</h1>
        <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4">INFORME VALORACIÓN INTEGRAL AVANZADA PODIUM</h2>
        <div className="text-xs sm:text-sm text-gray-600 text-left space-y-0.5 mt-3 sm:mt-4">
          <p><strong>Nombre completo:</strong> {patientName}</p>
          {patientDob && <p><strong>Fecha de nacimiento:</strong> {patientDob}</p>}
          {patientGender && <p><strong>Sexo:</strong> {patientGender === 'male' ? 'Hombre' : patientGender === 'female' ? 'Mujer' : 'Otro'}</p>}
        </div>
      </div>

      {/* Intro */}
      <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {reportData.portada_intro}
      </div>

      {/* Anamnesis */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">RESUMEN DE LA ANAMNESIS</h2>
        <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mt-3">
          {reportData.resumen_anamnesis}
        </div>
      </div>

      {/* Exploración */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">EXPLORACIÓN FÍSICA</h2>
        <div className="space-y-3 sm:space-y-4 mt-3 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <p className="italic">{reportData.exploracion_fisica.introduccion}</p>

          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Exploración visual</h3>
            <p className="whitespace-pre-wrap">{reportData.exploracion_fisica.exploracion_visual}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Palpación</h3>
            <p className="whitespace-pre-wrap">{reportData.exploracion_fisica.palpacion}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Sensibilidad</h3>
            <p className="whitespace-pre-wrap">{reportData.exploracion_fisica.sensibilidad}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Movilidad</h3>
            <p className="whitespace-pre-wrap">{reportData.exploracion_fisica.movilidad}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Tests ortopédicos</h3>
            <p className="whitespace-pre-wrap">{reportData.exploracion_fisica.tests_ortopedicos}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Fuerza</h3>
            <p className="whitespace-pre-wrap">{reportData.exploracion_fisica.fuerza}</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
            <h3 className="font-bold text-gray-900 mb-1">HALLAZGOS</h3>
            <p className="whitespace-pre-wrap">{reportData.exploracion_fisica.hallazgos}</p>
          </div>
        </div>
      </div>

      {/* Conclusiones */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">CONCLUSIONES FINALES</h2>
        <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mt-3">
          {reportData.conclusiones}
        </div>
      </div>

      {/* Descargo */}
      <div className="border-t border-gray-200 pt-4 sm:pt-6">
        <p className="text-[10px] sm:text-xs text-gray-500 italic leading-relaxed whitespace-pre-wrap">
          {reportData.descargo}
        </p>
      </div>

      <div className="text-center text-[10px] sm:text-xs text-gray-400 pt-4">
        www.clinicapodium.com - 608392019 - C/ Almagro 16 50004 Zaragoza
      </div>
    </div>
  )
}
