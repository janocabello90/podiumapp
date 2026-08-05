'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, RotateCcw, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { REPORT_TYPES, REPORT_TYPE_LABELS, REPORT_SECTIONS, DEFAULT_REPORT_INSTRUCTIONS, type ReportPromptType } from '@/lib/reports/prompt'

export default function ReportPromptsEditor({
  clinicId,
  initial,
}: {
  clinicId: string
  initial: Record<ReportPromptType, string>
}) {
  const supabase = createClient()
  const [values, setValues] = useState<Record<ReportPromptType, string>>(initial)
  const [saving, setSaving] = useState<ReportPromptType | null>(null)
  const [open, setOpen] = useState<ReportPromptType | null>('team')

  async function save(type: ReportPromptType) {
    setSaving(type)
    try {
      const { error } = await supabase
        .from('report_prompts')
        .upsert({ clinic_id: clinicId, type, instructions: values[type].trim(), updated_at: new Date().toISOString() }, { onConflict: 'clinic_id,type' })
      if (error) throw error
      toast.success('Instrucciones guardadas')
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  function reset(type: ReportPromptType) {
    if (!window.confirm('¿Restablecer las instrucciones por defecto de este informe?')) return
    setValues((v) => ({ ...v, [type]: DEFAULT_REPORT_INSTRUCTIONS[type] }))
  }

  return (
    <div className="space-y-4">
      {REPORT_TYPES.map((type) => {
        const isOpen = open === type
        return (
          <div key={type} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : type)}
              className="w-full flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-sm font-semibold text-gray-900">{REPORT_TYPE_LABELS[type]}</span>
              {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {isOpen && (
              <div className="px-4 sm:px-5 pb-5 space-y-3">
                {/* Referencia de secciones fijas */}
                <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="font-medium text-gray-600 mb-1">Secciones (fijas, no editables):</p>
                  <p>{REPORT_SECTIONS[type].join(' · ')}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rol e instrucciones para la IA</label>
                  <textarea
                    value={values[type]}
                    onChange={(e) => setValues((v) => ({ ...v, [type]: e.target.value }))}
                    rows={7}
                    placeholder="Ej.: Eres un fisioterapeuta del deporte especializado en prevención. Enfatiza el riesgo lesional y las asimetrías. Tono claro y útil para el cuerpo técnico…"
                    className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-y"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Esto define el rol, el tono y qué recalcar. La estructura de secciones y el formato del informe no cambian.</p>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => reset(type)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg">
                    <RotateCcw className="w-3.5 h-3.5" /> Restablecer por defecto
                  </button>
                  <button
                    onClick={() => save(type)}
                    disabled={saving === type}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
                  >
                    {saving === type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
