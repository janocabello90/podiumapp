'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'

// Editor del "Informe de Rendimiento y Prevención" (equipo). Estructura de 8 secciones.
// Los campos son editables (autoguardado al salir del campo). El fisio siempre puede ajustar.

type Semaforo = 'adecuado' | 'mejorable' | 'prioritario'

const SEMAFORO_AREAS: { key: string; label: string }[] = [
  { key: 'movilidad', label: 'Movilidad' },
  { key: 'fuerza', label: 'Fuerza' },
  { key: 'potencia', label: 'Potencia' },
  { key: 'control_motor', label: 'Control motor' },
  { key: 'capacidad_reactiva', label: 'Capacidad reactiva' },
  { key: 'simetria', label: 'Simetría' },
]

const SEMAFORO_COLOR: Record<Semaforo, string> = {
  adecuado: 'bg-emerald-500',
  mejorable: 'bg-amber-500',
  prioritario: 'bg-red-500',
}

export default function TeamReportEditor({
  reportId,
  patientName,
  initialData,
  initialStatus,
  documents,
  clinicLogoUrl,
}: {
  reportId: string
  patientName: string
  initialData: any
  initialStatus: string
  documents?: { file_name: string; storage_path: string }[]
  clinicLogoUrl?: string | null
}) {
  const router = useRouter()
  const [data, setData] = useState<any>(initialData || {})
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const approved = status === 'approved'

  async function exportPdf() {
    setExporting(true)
    try {
      const res = await fetch('/api/reports/export-pdf-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: data, patientName, documents: documents || [], clinicLogoUrl: clinicLogoUrl || null }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Informe_Rendimiento_${patientName.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setExporting(false)
    }
  }

  async function persist(next: any) {
    setSaving(true)
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_data: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  function getField(path: string): string {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), data) ?? ''
  }

  async function approve() {
    setSaving(true)
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', report_data: data }),
      })
      if (!res.ok) throw new Error()
      setStatus('approved')
      toast.success('Informe aprobado')
      router.refresh()
    } catch {
      toast.error('No se pudo aprobar')
    } finally {
      setSaving(false)
    }
  }

  const perfil = data.perfil || {}

  return (
    <div className="space-y-5">
      {/* Barra de estado */}
      <div className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">Informe de Rendimiento y Prevención</span>
          {approved ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-lg"><Check className="w-3 h-3" /> Aprobado</span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-lg">Borrador</span>
          )}
          {saving && <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</span>}
        </div>
        <div className="flex items-center gap-2">
          {!approved && (
            <button onClick={approve} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl disabled:opacity-50">
              <Check className="w-4 h-4" /> Aprobar
            </button>
          )}
          <button onClick={exportPdf} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
          </button>
        </div>
      </div>

      {/* Perfil del deportista (datos, solo lectura) */}
      <Section title="1. Perfil del deportista">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <Dato label="Nombre" value={perfil.nombre} />
          <Dato label="Edad" value={perfil.edad != null ? `${perfil.edad} años` : null} />
          <Dato label="Sexo" value={perfil.sexo} />
          <Dato label="Deporte" value={perfil.deporte} />
          <Dato label="Posición" value={perfil.posicion} />
          <Dato label="Categoría" value={perfil.categoria} />
          <Dato label="Equipo" value={perfil.equipo} />
          <Dato label="Altura / Peso" value={(perfil.altura_cm || perfil.peso_kg) ? `${perfil.altura_cm ?? '—'} cm / ${perfil.peso_kg ?? '—'} kg` : null} />
          <Dato label="Lateralidad" value={perfil.lateralidad} />
          <Dato label="Horas entreno/sem" value={perfil.horas_entreno_semana != null ? String(perfil.horas_entreno_semana) : null} />
        </div>
      </Section>

      <Section title="Objetivo del informe">
        <Field value={getField('objetivo_intro')} onSave={(v) => savePath('objetivo_intro', v)} disabled={approved} />
      </Section>

      <Section title="2. Anamnesis deportiva">
        <Field path="resumen_anamnesis" value={getField('resumen_anamnesis')} onSave={(v) => savePath('resumen_anamnesis', v)} disabled={approved} />
      </Section>

      <Section title="3. Valoración funcional">
        <SubField label="Introducción" path="valoracion_funcional.introduccion" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="3.1 Calidad del movimiento" path="valoracion_funcional.calidad_movimiento" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="3.2 Movilidad" path="valoracion_funcional.movilidad" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="3.3 Fuerza" path="valoracion_funcional.fuerza" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="3.4 Potencia" path="valoracion_funcional.potencia" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="3.5 Capacidad reactiva" path="valoracion_funcional.capacidad_reactiva" get={getField} onSave={savePath} disabled={approved} />
        <p className="text-xs text-gray-400 mt-2">Las gráficas de VALD (PDF subido a la consulta) se incrustan aquí al exportar el PDF.</p>
      </Section>

      <Section title="4. Hallazgos principales">
        <Field path="hallazgos" value={getField('hallazgos')} onSave={(v) => savePath('hallazgos', v)} disabled={approved} />
      </Section>

      <Section title="5. Semáforo funcional">
        <div className="space-y-2">
          {SEMAFORO_AREAS.map((a) => {
            const val = (getField(`semaforo.${a.key}`) || 'mejorable') as Semaforo
            return (
              <div key={a.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 inline-flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${SEMAFORO_COLOR[val] || 'bg-gray-300'}`} />
                  {a.label}
                </span>
                <select
                  value={val}
                  disabled={approved}
                  onChange={(e) => savePath(`semaforo.${a.key}`, e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                >
                  <option value="adecuado">Adecuado</option>
                  <option value="mejorable">Mejorable</option>
                  <option value="prioritario">Prioritario</option>
                </select>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="6. Conclusiones">
        <Field path="conclusiones" value={getField('conclusiones')} onSave={(v) => savePath('conclusiones', v)} disabled={approved} />
      </Section>

      <Section title="7. Recomendaciones">
        <SubField label="Capacidades prioritarias a desarrollar" path="recomendaciones.capacidades_prioritarias" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="Aspectos a monitorizar" path="recomendaciones.aspectos_monitorizar" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="Recomendaciones para el cuerpo técnico" path="recomendaciones.cuerpo_tecnico" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="Siguiente valoración funcional" path="recomendaciones.siguiente_valoracion" get={getField} onSave={savePath} disabled={approved} />
      </Section>

      <Section title="8. Resumen ejecutivo">
        <SubField label="Fortalezas" path="resumen_ejecutivo.fortalezas" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="Aspectos a mejorar" path="resumen_ejecutivo.aspectos_mejorar" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="Riesgo funcional" path="resumen_ejecutivo.riesgo_funcional" get={getField} onSave={savePath} disabled={approved} />
        <SubField label="Objetivo principal" path="resumen_ejecutivo.objetivo_principal" get={getField} onSave={savePath} disabled={approved} />
      </Section>

      <Section title="Descargo de responsabilidad">
        <Field path="descargo" value={getField('descargo')} onSave={(v) => savePath('descargo', v)} disabled={approved} small />
      </Section>
    </div>
  )

  // set + persist en una ruta (usa el estado más reciente)
  function savePath(path: string, value: any) {
    setData((prev: any) => {
      const next = structuredClone(prev)
      const keys = path.split('.')
      let cur = next
      for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = cur[keys[i]] ?? {}; cur = cur[keys[i]] }
      cur[keys[keys.length - 1]] = value
      persist(next)
      return next
    })
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Dato({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-gray-800">{value || '—'}</p>
    </div>
  )
}

function Field({ value, onSave, disabled, small }: { path?: string; value: string; onSave: (v: string) => void; disabled?: boolean; small?: boolean }) {
  const [v, setV] = useState(value)
  return (
    <textarea
      defaultValue={value}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v) }}
      disabled={disabled}
      rows={small ? 4 : 5}
      className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-y disabled:bg-gray-50"
    />
  )
}

function SubField({ label, path, get, onSave, disabled }: { label: string; path: string; get: (p: string) => string; onSave: (p: string, v: string) => void; disabled?: boolean }) {
  const initial = get(path)
  const [v, setV] = useState(initial)
  return (
    <div className="mb-3 last:mb-0">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea
        defaultValue={initial}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== initial) onSave(path, v) }}
        disabled={disabled}
        rows={3}
        className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-y disabled:bg-gray-50"
      />
    </div>
  )
}
