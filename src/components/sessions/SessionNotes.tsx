'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Props {
  sessionId: string
  initialNotes: string
}

/** Anotaciones generales del fisioterapeuta para la sesión (se guardan en sessions.notes
 *  y se incluyen en el contexto del informe IA). Autoguardado al salir del campo. */
export default function SessionNotes({ sessionId, initialNotes }: Props) {
  const supabase = createClient()
  const [value, setValue] = useState(initialNotes)
  const [savedValue, setSavedValue] = useState(initialNotes)
  const [saving, setSaving] = useState(false)

  const dirty = value !== savedValue

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    const { error } = await supabase
      .from('sessions')
      .update({ notes: value.trim() ? value : null })
      .eq('id', sessionId)
    setSaving(false)
    if (error) {
      toast.error('No se pudieron guardar las anotaciones')
      return
    }
    setSavedValue(value)
    toast.success('Anotaciones guardadas')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={5}
        placeholder="Impresión general, observaciones, recomendaciones o cualquier contexto adicional que consideres. Se incluirá en el informe."
        className="w-full text-sm text-gray-800 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-y"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          {saving ? 'Guardando…' : dirty ? 'Sin guardar' : 'Guardado'}
        </span>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
