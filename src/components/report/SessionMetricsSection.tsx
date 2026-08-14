'use client'

import { useState } from 'react'
import { Loader2, Check, Database as DbIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { MetricDef } from '@/lib/reports/metrics'

// Una prueba de la sesión con sus métricas clave (definición) y sus valores extraídos.
export interface MetricTest {
  id: string
  test_name: string
  metrics: MetricDef[]
  values: Record<string, any>
}

// Sección "Datos objetivos (VALD)" en la revisión del individual.
// - Muestra/edita las cifras extraídas por la IA (session_tests.result_data), celda a celda.
// - Avisa de que NO salen en el PDF, con toggle para incluirlas.
// - Al guardar marca _meta.revisado = true (deja de avisar de "sin revisar").
export default function SessionMetricsSection({
  tests,
  includeInPdf,
  onToggleInclude,
  disabled,
}: {
  tests: MetricTest[]
  includeInPdf: boolean
  onToggleInclude: (v: boolean) => void
  disabled?: boolean
}) {
  const supabase = createClient()
  const [state, setState] = useState<Record<string, Record<string, any>>>(() => {
    const init: Record<string, Record<string, any>> = {}
    for (const t of tests) init[t.id] = { ...(t.values || {}) }
    return init
  })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const t of tests) init[t.id] = !!t.values?._meta?.revisado
    return init
  })

  if (tests.length === 0) return null

  function setCell(testId: string, metricKey: string, field: string, raw: string) {
    setState((prev) => {
      const t = { ...(prev[testId] || {}) }
      const m = { ...(t[metricKey] || {}) }
      if (field === 'lado') m[field] = raw || null
      else m[field] = raw === '' ? null : Number(raw)
      t[metricKey] = m
      return { ...prev, [testId]: t }
    })
  }

  async function saveTest(testId: string) {
    setSavingId(testId)
    try {
      const values = { ...(state[testId] || {}) }
      const result_data = { ...values, _meta: { fuente: values?._meta?.fuente || 'ia', revisado: true } }
      const { error } = await supabase.from('session_tests').update({ result_data }).eq('id', testId)
      if (error) throw new Error(error.message)
      setReviewed((r) => ({ ...r, [testId]: true }))
      setState((prev) => ({ ...prev, [testId]: result_data }))
      toast.success('Datos guardados')
    } catch (e: any) {
      toast.error('No se pudieron guardar los datos')
    } finally {
      setSavingId(null)
    }
  }

  const numInput = 'w-16 text-sm border border-gray-200 rounded-md px-1.5 py-1 text-right outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50'
  const anySinRevisar = tests.some((t) => !reviewed[t.id])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <DbIcon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Datos objetivos (VALD)</h3>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          ⚠ Estos datos <strong>no se incluyen en el PDF</strong> (alimentan el informe de equipo).
          {anySinRevisar && ' Revísalos antes de aprobar.'}
        </p>
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 flex-shrink-0">
          <input
            type="checkbox"
            checked={includeInPdf}
            disabled={disabled}
            onChange={(e) => onToggleInclude(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Incluir en el PDF
        </label>
      </div>

      <div className="space-y-4">
        {tests.map((t) => (
          <div key={t.id} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-800">{t.test_name}</p>
              <div className="flex items-center gap-2">
                {reviewed[t.id] ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-green-600"><Check className="w-3 h-3" /> revisado</span>
                ) : (
                  <span className="text-[11px] text-amber-600">sin revisar</span>
                )}
                <button
                  onClick={() => saveTest(t.id)}
                  disabled={disabled || savingId === t.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] rounded-md disabled:opacity-50"
                >
                  {savingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Guardar
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {t.metrics.map((m) => {
                const v = state[t.id]?.[m.key] || {}
                return (
                  <div key={m.key} className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-gray-600 w-40 truncate" title={m.label}>{m.label}{m.unit ? ` (${m.unit})` : ''}</span>
                    {m.bilateral ? (
                      <>
                        <span className="text-[11px] text-gray-400">izq</span>
                        <input className={numInput} disabled={disabled} type="number" step="any" value={v.izq ?? ''} onChange={(e) => setCell(t.id, m.key, 'izq', e.target.value)} />
                        <span className="text-[11px] text-gray-400">der</span>
                        <input className={numInput} disabled={disabled} type="number" step="any" value={v.der ?? ''} onChange={(e) => setCell(t.id, m.key, 'der', e.target.value)} />
                        {m.percentil && (
                          <>
                            <span className="text-[11px] text-gray-400">pct izq</span>
                            <input className={numInput} disabled={disabled} type="number" step="any" value={v.pct_izq ?? ''} onChange={(e) => setCell(t.id, m.key, 'pct_izq', e.target.value)} />
                            <span className="text-[11px] text-gray-400">pct der</span>
                            <input className={numInput} disabled={disabled} type="number" step="any" value={v.pct_der ?? ''} onChange={(e) => setCell(t.id, m.key, 'pct_der', e.target.value)} />
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <input className={numInput} disabled={disabled} type="number" step="any" value={v.valor ?? ''} onChange={(e) => setCell(t.id, m.key, 'valor', e.target.value)} />
                        {m.percentil && (
                          <>
                            <span className="text-[11px] text-gray-400">pct</span>
                            <input className={numInput} disabled={disabled} type="number" step="any" value={v.percentil ?? ''} onChange={(e) => setCell(t.id, m.key, 'percentil', e.target.value)} />
                          </>
                        )}
                        <select className="text-xs border border-gray-200 rounded-md px-1 py-1 bg-white disabled:bg-gray-50" disabled={disabled} value={v.lado ?? ''} onChange={(e) => setCell(t.id, m.key, 'lado', e.target.value)}>
                          <option value="">lado —</option>
                          <option value="izq">izq</option>
                          <option value="der">der</option>
                        </select>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
