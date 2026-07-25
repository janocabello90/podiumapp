'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type TestOption = { id: string; name: string; description: string | null }
type Link = { id: string; test_id: string; display_order: number | null; is_required: boolean | null }

type RowState = { linkId: string | null; included: boolean; order: number; required: boolean }

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
  const linkByTest = new Map(initialLinks.map((l) => [l.test_id, l]))
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const r: Record<string, RowState> = {}
    for (const t of tests) {
      const l = linkByTest.get(t.id)
      r[t.id] = {
        linkId: l?.id ?? null,
        included: !!l,
        order: l?.display_order ?? 0,
        required: !!l?.is_required,
      }
    }
    return r
  })

  function setRow(testId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [testId]: { ...prev[testId], ...patch } }))
  }

  async function toggleInclude(testId: string) {
    const row = rows[testId]
    if (!row.included) {
      // incluir → insertar sport_tests
      try {
        const { data, error } = await supabase
          .from('sport_tests')
          .insert({ clinic_id: clinicId, sport_id: sportId, test_id: testId, display_order: row.order, is_required: row.required })
          .select('id')
          .single()
        if (error) throw error
        setRow(testId, { included: true, linkId: (data as any).id })
      } catch (err: any) {
        toast.error(err.message || 'Error al añadir la prueba')
      }
    } else {
      // excluir → borrar sport_tests
      try {
        if (row.linkId) {
          const { error } = await supabase.from('sport_tests').delete().eq('id', row.linkId)
          if (error) throw error
        }
        setRow(testId, { included: false, linkId: null })
      } catch (err: any) {
        toast.error(err.message || 'Error al quitar la prueba')
      }
    }
  }

  async function updateLink(testId: string, patch: { display_order?: number; is_required?: boolean }) {
    const row = rows[testId]
    if (!row.included || !row.linkId) return
    try {
      const { error } = await supabase.from('sport_tests').update(patch).eq('id', row.linkId)
      if (error) throw error
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar')
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
    <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
      {tests.map((t) => {
        const row = rows[t.id]
        return (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={row.included}
              onChange={() => toggleInclude(t.id)}
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
                    onBlur={() => updateLink(t.id, { display_order: row.order })}
                    className="w-14 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={row.required}
                    onChange={(e) => {
                      const v = e.target.checked
                      setRow(t.id, { required: v })
                      updateLink(t.id, { is_required: v })
                    }}
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
  )
}
