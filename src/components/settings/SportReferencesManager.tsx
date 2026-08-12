'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Plus, Trash2, Pencil, X, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SportReference } from '@/types/database'
import { referenceProfileText } from '@/lib/reports/references'

type Ref = SportReference

const EMPTY = {
  name: '',
  sex: 'any',
  age_min: '',
  age_max: '',
  level: '',
  phase: '',
  season: '',
  prompt: '',
  body_md: '',
}

export default function SportReferencesManager({
  clinicId,
  sportId,
  initialReferences,
}: {
  clinicId: string
  sportId: string
  initialReferences: Ref[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [refs, setRefs] = useState<Ref[]>(initialReferences)
  const [editing, setEditing] = useState<string | null>(null) // id o 'new'
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openNew() {
    setForm({ ...EMPTY })
    setEditing('new')
  }

  function openEdit(r: Ref) {
    setForm({
      name: r.name || '',
      sex: r.sex || 'any',
      age_min: r.age_min != null ? String(r.age_min) : '',
      age_max: r.age_max != null ? String(r.age_max) : '',
      level: r.level || '',
      phase: r.phase || '',
      season: r.season || '',
      prompt: r.prompt || '',
      body_md: r.body_md || '',
    })
    setEditing(r.id)
  }

  function cancel() {
    setEditing(null)
    setForm({ ...EMPTY })
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Ponle un nombre a la referencia')
      return
    }
    if (!form.body_md.trim()) {
      toast.error('El contenido (Markdown) no puede estar vacío')
      return
    }
    setSaving(true)
    const payload = {
      clinic_id: clinicId,
      sport_id: sportId,
      name: form.name.trim(),
      sex: form.sex || 'any',
      age_min: form.age_min.trim() ? parseInt(form.age_min, 10) : null,
      age_max: form.age_max.trim() ? parseInt(form.age_max, 10) : null,
      level: form.level.trim() || null,
      phase: form.phase.trim() || null,
      season: form.season.trim() || null,
      prompt: form.prompt.trim() || null,
      body_md: form.body_md,
      updated_at: new Date().toISOString(),
    }
    try {
      if (editing === 'new') {
        const { data, error } = await supabase.from('sport_references').insert(payload).select('*').single()
        if (error) throw error
        setRefs((prev) => [...prev, data as Ref])
      } else {
        const { data, error } = await supabase.from('sport_references').update(payload).eq('id', editing).select('*').single()
        if (error) throw error
        setRefs((prev) => prev.map((r) => (r.id === editing ? (data as Ref) : r)))
      }
      toast.success('Referencia guardada')
      cancel()
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function remove(r: Ref) {
    if (!confirm(`¿Eliminar la referencia "${r.name}"?`)) return
    setDeletingId(r.id)
    try {
      const { error } = await supabase.from('sport_references').delete().eq('id', r.id)
      if (error) throw error
      setRefs((prev) => prev.filter((x) => x.id !== r.id))
      toast.success('Referencia eliminada')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-gray-900">Referencias / baremos</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Documentos normativos (en Markdown) que se pueden adjuntar a la IA al generar el informe, para comparar al jugador contra normas de su deporte.
          </p>
        </div>
        {editing === null && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-lg flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Nueva
          </button>
        )}
      </div>

      {/* Lista */}
      {refs.length === 0 && editing === null && (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-2">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500">Aún no hay referencias para este deporte.</p>
        </div>
      )}

      {refs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 mb-3">
          {refs.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {r.name}
                  {!r.is_active && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">inactiva</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{referenceProfileText(r)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(r)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(r)} disabled={deletingId === r.id} className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Eliminar">
                  {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario */}
      {editing !== null && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{editing === 'new' ? 'Nueva referencia' : 'Editar referencia'}</h3>
            <button onClick={cancel} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="p. ej. Percentiles Premier League 2025/26"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sexo</label>
              <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="any">Cualquiera</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Edad mín.</label>
              <input value={form.age_min} onChange={(e) => setForm({ ...form, age_min: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="19"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Edad máx.</label>
              <input value={form.age_max} onChange={(e) => setForm({ ...form, age_max: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="40"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nivel (opcional)</label>
              <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="élite / amateur…"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fase (opcional)</label>
              <input value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} placeholder="pretemporada / in-season"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Temporada (opcional)</label>
              <input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="2025/26"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prompt / cómo usar la referencia (opcional)</label>
            <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} rows={2}
              placeholder="Instrucción para la IA: p. ej. «compara la fuerza y el salto del jugador contra estos percentiles; recuerda que son de fútbol masculino de élite»."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contenido (Markdown) *</label>
            <textarea value={form.body_md} onChange={(e) => setForm({ ...form, body_md: e.target.value })} rows={10}
              placeholder={'Pega aquí las tablas del baremo en Markdown (percentiles p5/p25/mediana/p75/p95 por prueba y métrica).'}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-y" />
            <p className="text-[11px] text-gray-400 mt-1">Se envía a la IA como texto (no como PDF): ocupa muy poco y se lee sin errores.</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-lg disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
