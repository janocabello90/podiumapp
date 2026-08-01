'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'

type CatalogTest = { id: string; name: string }
type SelectedRow = { id: string; test_id: string | null; test_name: string; notes: string | null }

/** Selector de pruebas para sesiones individuales: sin deporte, el fisio marca del catálogo
 *  completo de la clínica qué pruebas ha realizado (p. ej. con el VALD) y anota cada una.
 *  Marcar crea una fila en session_tests; desmarcar la elimina; las notas se guardan por prueba. */
export default function SessionTestPicker({
  sessionId,
  clinicId,
  catalog,
  initialSelected,
}: {
  sessionId: string
  clinicId: string
  catalog: CatalogTest[]
  initialSelected: SelectedRow[]
}) {
  const supabase = createClient()
  const [selected, setSelected] = useState<Record<string, { rowId: string; notes: string }>>(() => {
    const m: Record<string, { rowId: string; notes: string }> = {}
    for (const r of initialSelected) if (r.test_id) m[r.test_id] = { rowId: r.id, notes: r.notes ?? '' }
    return m
  })
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(test: CatalogTest) {
    if (busy) return
    setBusy(test.id)
    try {
      const cur = selected[test.id]
      if (cur) {
        const { error } = await supabase.from('session_tests').delete().eq('id', cur.rowId)
        if (error) throw error
        setSelected((prev) => {
          const next = { ...prev }
          delete next[test.id]
          return next
        })
      } else {
        const { data, error } = await supabase
          .from('session_tests')
          .insert({
            clinic_id: clinicId,
            session_id: sessionId,
            test_id: test.id,
            test_name: test.name,
            status: 'done',
            display_order: 0,
            is_required: false,
          })
          .select('id')
          .single()
        if (error) throw error
        setSelected((prev) => ({ ...prev, [test.id]: { rowId: data.id, notes: '' } }))
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar la prueba')
    } finally {
      setBusy(null)
    }
  }

  async function saveNotes(testId: string, notes: string) {
    const cur = selected[testId]
    if (!cur) return
    setSelected((prev) => ({ ...prev, [testId]: { ...prev[testId], notes } }))
    const { error } = await supabase.from('session_tests').update({ notes }).eq('id', cur.rowId)
    if (error) toast.error('Error al guardar la nota')
  }

  if (catalog.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 px-4 py-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
        </div>
        <p className="text-sm text-gray-500">
          No hay pruebas configuradas en la clínica. Un administrador puede añadirlas en Ajustes → Deportes y pruebas.
        </p>
      </div>
    )
  }

  const count = Object.keys(selected).length

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">
        Marca las pruebas realizadas (p. ej. con el VALD) y añade notas de interpretación.
        {count > 0 && <span className="text-gray-500"> · {count} seleccionada{count !== 1 ? 's' : ''}</span>}
      </p>
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {catalog.map((t) => {
          const sel = selected[t.id]
          return (
            <div key={t.id} className="p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!sel}
                  disabled={busy === t.id}
                  onChange={() => toggle(t)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-900">{t.name}</span>
              </label>
              {sel && (
                <textarea
                  defaultValue={sel.notes}
                  onBlur={(e) => saveNotes(t.id, e.target.value)}
                  placeholder="Notas / interpretación de esta prueba…"
                  rows={2}
                  className="mt-2 ml-7 w-[calc(100%-1.75rem)] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
