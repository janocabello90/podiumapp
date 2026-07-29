'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type TestOption = { id: string; name: string; description: string | null }
type Link = { id: string; test_id: string; display_order: number | null; is_required: boolean | null }

type RowState = { linkId: string | null; included: boolean; order: number; required: boolean }

function buildState(tests: TestOption[], links: Link[]): Record<string, RowState> {
  const byTest = new Map(links.map((l) => [l.test_id, l]))
  const r: Record<string, RowState> = {}
  for (const t of tests) {
    const l = byTest.get(t.id)
    r[t.id] = { linkId: l?.id ?? null, included: !!l, order: l?.display_order ?? 0, required: !!l?.is_required }
  }
  return r
}

function sameRow(a: RowState, b: RowState): boolean {
  if (a.included !== b.included) return false
  if (!a.included) return true // ambos excluidos → sin cambios relevantes
  return a.order === b.order && a.required === b.required
}

export default function SportTestsEditor({
  clinicId,
  sportId,
  tests,
  initialLinks,
}: {
  clinicId: string
  sportId: string
  tests: TestOption[]
  initialLinks: Link[]
}) {
  const supabase = createClient()
  const [saved, setSaved] = useState<Record<string, RowState>>(() => buildState(tests, initialLinks))
  const [rows, setRows] = useState<Record<string, RowState>>(() => buildState(tests, initialLinks))
  const [saving, setSaving] = useState(false)

  const dirty = tests.some((t) => !sameRow(rows[t.id], saved[t.id]))

  function setRow(testId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [testId]: { ...prev[testId], ...patch } }))
  }

  async function saveChanges() {
    setSaving(true)
    try {
      const next = { ...rows }
      for (const t of tests) {
        const cur = rows[t.id]
        const init = saved[t.id]
        if (sameRow(cur, init) && cur.included === init.included) continue

        if (cur.included && !init.included) {
          // añadir
          const { data, error } = await supabase
            .from('sport_tests')
            .insert({ clinic_id: clinicId, sport_id: sportId, test_id: t.id, display_order: cur.order, is_required: cur.required })
            .select('id')
            .single()
          if (error) throw error
          next[t.id] = { ...cur, linkId: (data as any).id }
        } else if (!cur.included && init.included) {
          // quitar
          if (init.linkId) {
            const { error } = await supabase.from('sport_tests').delete().eq('id', init.linkId)
            if (error) throw error
          }
          next[t.id] = { ...cur, linkId: null }
        } else if (cur.included && init.included && (cur.order !== init.order || cur.required !== init.required)) {
          // actualizar
          if (init.linkId) {
            const { error } = await supabase
              .from('sport_tests')
              .update({ display_order: cur.order, is_required: cur.required })
              .eq('id', init.linkId)
            if (error) throw error
          }
          next[t.id] = { ...cur, linkId: init.linkId }
        }
      }
      setRows(next)
      setSaved(next)
      toast.success('Mapeo guardado')
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar el mapeo')
    } finally {
      setSaving(false)
    }
  }

  if (tests.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-8 text-center text-sm text-gray-500">
        No hay pruebas en el catálogo todavía. Créalas en{' '}
        <a href="/settings/tests" className="text-blue-600 hover:underline">Catálogo de pruebas</a>.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {tests.map((t) => {
          const row = rows[t.id]
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={row.included}
                onChange={(e) => setRow(t.id, { included: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                {t.description && <p className="text-xs text-gray-500 truncate">{t.description}</p>}
              </div>
              {row.included && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    Orden
                    <input
                      type="number"
                      value={row.order}
                      onChange={(e) => setRow(t.id, { order: Number(e.target.value) })}
                      className="w-14 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(e) => setRow(t.id, { required: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Requerida
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Barra de guardado */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">
          {dirty ? 'Tienes cambios sin guardar' : (
            <span className="inline-flex items-center gap-1 text-green-600">
              <Check className="w-3.5 h-3.5" /> Todo guardado
            </span>
          )}
        </span>
        <button
          onClick={saveChanges}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>
    </div>
  )
}
