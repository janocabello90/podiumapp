'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ClipboardList, Check } from 'lucide-react'
import VoiceDictation from '@/components/assessment/VoiceDictation'
import { useDebouncedRefresh } from '@/lib/hooks/useDebouncedRefresh'
import toast from 'react-hot-toast'

type SessionTest = {
  id: string
  test_name: string
  status: string | null
  notes: string | null
  display_order: number | null
  is_required: boolean | null
}

const STATUS = [
  { v: 'pending', label: 'Pendiente' },
  { v: 'done', label: 'Realizada' },
  { v: 'skipped', label: 'Omitida' },
]

export default function SessionTestsPanel({
  sessionId,
  clinicId,
  sportId,
  initialTests,
}: {
  sessionId: string
  clinicId: string
  sportId: string | null
  initialTests: SessionTest[]
}) {
  const router = useRouter()
  const scheduleRefresh = useDebouncedRefresh()
  const supabase = createClient()
  const [tests, setTests] = useState<SessionTest[]>(initialTests)
  const [loadingSport, setLoadingSport] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Muestra "Guardado ✓" en la prueba `id` durante ~2 s.
  function flashSaved(id: string) {
    setSavedId(id)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 2000)
  }

  function setLocal(id: string, patch: Partial<SessionTest>) {
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  async function saveStatus(id: string, status: string) {
    setLocal(id, { status })
    const { error } = await supabase.from('session_tests').update({ status }).eq('id', id)
    if (error) toast.error('Error al guardar')
    else { flashSaved(id); scheduleRefresh() }
  }

  async function saveNotes(id: string, notes: string) {
    const { error } = await supabase.from('session_tests').update({ notes }).eq('id', id)
    if (error) toast.error('Error al guardar la nota')
    else { flashSaved(id); scheduleRefresh() }
  }

  async function loadFromSport() {
    if (!sportId) return
    setLoadingSport(true)
    try {
      const { data: mapping } = await supabase
        .from('sport_tests')
        .select('test_id, display_order, is_required, tests(name)')
        .eq('sport_id', sportId)
        .eq('clinic_id', clinicId)
        .order('display_order', { ascending: true })
      const existing = new Set(tests.map((t) => t.test_name))
      const rows = (mapping || [])
        .filter((m: any) => !existing.has(m.tests?.name))
        .map((m: any) => ({
          clinic_id: clinicId,
          session_id: sessionId,
          test_id: m.test_id,
          test_name: m.tests?.name ?? 'Prueba',
          display_order: m.display_order ?? 0,
          is_required: !!m.is_required,
          status: 'pending',
        }))
      if (rows.length === 0) {
        toast('No hay pruebas nuevas del deporte')
        return
      }
      const { error } = await supabase.from('session_tests').insert(rows)
      if (error) throw error
      toast.success(`${rows.length} prueba(s) cargada(s)`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar pruebas')
    } finally {
      setLoadingSport(false)
    }
  }

  const sorted = [...tests].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {sportId ? 'Esta sesión no tiene pruebas todavía.' : 'Sin deporte asignado: no hay pruebas preconfiguradas.'}
          </p>
          {sportId && (
            <button
              onClick={loadFromSport}
              disabled={loadingSport}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-xs font-medium rounded-lg disabled:opacity-50"
            >
              {loadingSport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
              Cargar pruebas del deporte
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {sorted.map((t) => (
              <div key={t.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {t.test_name}
                    {t.is_required && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">requerida</span>}
                  </p>
                  <select
                    value={t.status ?? 'pending'}
                    onChange={(e) => saveStatus(t.id, e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {STATUS.map((s) => (
                      <option key={s.v} value={s.v}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span
                    className={`inline-flex items-center gap-1 text-xs text-green-600 transition-opacity duration-300 ${savedId === t.id ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <Check className="w-3.5 h-3.5" /> Guardado
                  </span>
                  <VoiceDictation
                    currentText={t.notes ?? ''}
                    onTranscription={(text) => { setLocal(t.id, { notes: text }); saveNotes(t.id, text) }}
                    placeholder="Dictar notas de la prueba"
                  />
                </div>
                <textarea
                  value={t.notes ?? ''}
                  onChange={(e) => setLocal(t.id, { notes: e.target.value })}
                  onBlur={(e) => saveNotes(t.id, e.target.value)}
                  placeholder="Notas de interpretación de esta prueba…"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            ))}
          </div>
          {sportId && (
            <button
              onClick={loadFromSport}
              disabled={loadingSport}
              className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              {loadingSport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Recargar pruebas del deporte
            </button>
          )}
        </>
      )}
    </div>
  )
}
