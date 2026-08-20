'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConsentVersion } from '@/types/database'
import { CONSENT_TYPES } from '@/lib/clinical/consents'
import { Save, Loader2, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = { clinicId: string; initialVersions: ConsentVersion[] }

type FormState = { id: string | null; version_label: string; body: string }

export default function ConsentsManager({ clinicId, initialVersions }: Props) {
  const supabase = createClient()
  const byType = new Map(initialVersions.map((v) => [v.type, v]))

  const [forms, setForms] = useState<Record<string, FormState>>(() => {
    const f: Record<string, FormState> = {}
    for (const { type } of CONSENT_TYPES) {
      const v = byType.get(type)
      f[type] = { id: v?.id ?? null, version_label: v?.version_label ?? 'v1', body: v?.body ?? '' }
    }
    return f
  })
  const [savingType, setSavingType] = useState<string | null>(null)

  function setField(type: string, patch: Partial<FormState>) {
    setForms((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }))
  }

  async function save(type: string) {
    const f = forms[type]
    if (!f.body.trim()) return toast.error('El texto del consentimiento es obligatorio')
    if (!f.version_label.trim()) return toast.error('La etiqueta de versión es obligatoria')
    setSavingType(type)
    try {
      if (f.id) {
        const { error } = await supabase
          .from('consent_versions')
          .update({ version_label: f.version_label.trim(), body: f.body.trim() })
          .eq('id', f.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('consent_versions')
          .insert({ clinic_id: clinicId, type, version_label: f.version_label.trim(), body: f.body.trim(), is_active: true })
          .select('id')
          .single()
        if (error) throw error
        setField(type, { id: (data as any).id })
      }
      toast.success('Consentimiento guardado')
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setSavingType(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Textos de los consentimientos que el paciente acepta en la anamnesis. Al aceptarlos queda registrada
        una copia con fecha (trazabilidad); cambiar el texto aquí no altera los consentimientos ya registrados.
      </p>

      <a
        href="/api/consents/print-template"
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
      >
        <FileDown className="w-4 h-4" /> Descargar plantilla en blanco (PDF) — para rellenar a mano
      </a>

      {CONSENT_TYPES.map(({ type, label }) => {
        const f = forms[type]
        return (
          <div key={type} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
              <input
                value={f.version_label}
                onChange={(e) => setField(type, { version_label: e.target.value })}
                placeholder="versión"
                className="w-28 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <textarea
              value={f.body}
              onChange={(e) => setField(type, { body: e.target.value })}
              placeholder={`Texto del consentimiento de ${label.toLowerCase()}…`}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            <button
              onClick={() => save(type)}
              disabled={savingType === type}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {savingType === type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        )
      })}
    </div>
  )
}
