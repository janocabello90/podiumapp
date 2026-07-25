'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type SportOption = { id: string; name: string }

// Selector de deporte reutilizable para `teams` (deporte por defecto) y
// `patients` (override individual). Actualiza <table>.sport_id via RLS
// clínica-scoped. Sin efecto en runtime hasta la Fase D (resolución de pruebas).
export default function SportSelect({
  table,
  rowId,
  currentSportId,
  sports,
  label,
}: {
  table: 'teams' | 'patients'
  rowId: string
  currentSportId: string | null
  sports: SportOption[]
  label?: string
}) {
  const supabase = createClient()
  const [value, setValue] = useState<string>(currentSportId ?? '')
  const [saving, setSaving] = useState(false)

  async function onChange(next: string) {
    const prev = value
    setValue(next)
    setSaving(true)
    try {
      const { error } = await supabase
        .from(table)
        .update({ sport_id: next || null })
        .eq('id', rowId)
      if (error) throw error
    } catch (err: any) {
      setValue(prev)
      toast.error(err.message || 'Error al guardar el deporte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      {label && <span className="text-gray-500">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
      >
        <option value="">Sin deporte</option>
        {sports.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  )
}
