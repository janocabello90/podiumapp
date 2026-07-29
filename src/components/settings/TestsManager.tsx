'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Test } from '@/types/database'
import { Plus, Pencil, Trash2, Check, X, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = { clinicId: string; initialTests: Test[] }

const empty = { name: '', description: '', vald_interpretation_prompt: '' }

export default function TestsManager({ clinicId, initialTests }: Props) {
  const supabase = createClient()
  const [tests, setTests] = useState<Test[]>(initialTests)
  const [creating, setCreating] = useState(empty)
  const [savingNew, setSavingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(empty)

  async function createTest(e: React.FormEvent) {
    e.preventDefault()
    if (!creating.name.trim()) return toast.error('El nombre de la prueba es obligatorio')
    setSavingNew(true)
    try {
      const { data, error } = await supabase
        .from('tests')
        .insert({
          clinic_id: clinicId,
          name: creating.name.trim(),
          description: creating.description.trim() || null,
          vald_interpretation_prompt: creating.vald_interpretation_prompt.trim() || null,
        })
        .select()
        .single()
      if (error) throw error
      setTests((prev) => [...prev, data as Test].sort((a, b) => a.name.localeCompare(b.name)))
      setCreating(empty)
      toast.success('Prueba creada')
    } catch (err: any) {
      toast.error(err.message?.includes('duplicate') ? 'Ya existe una prueba con ese nombre' : (err.message || 'Error al crear'))
    } finally {
      setSavingNew(false)
    }
  }

  function startEdit(t: Test) {
    setEditingId(t.id)
    setEditForm({
      name: t.name,
      description: t.description || '',
      vald_interpretation_prompt: t.vald_interpretation_prompt || '',
    })
  }

  async function saveEdit(id: string) {
    if (!editForm.name.trim()) return toast.error('El nombre es obligatorio')
    try {
      const patch = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        vald_interpretation_prompt: editForm.vald_interpretation_prompt.trim() || null,
      }
      const { error } = await supabase.from('tests').update(patch).eq('id', id)
      if (error) throw error
      setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      setEditingId(null)
      toast.success('Prueba actualizada')
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    }
  }

  async function toggleActive(t: Test) {
    const next = !t.is_active
    try {
      const { error } = await supabase.from('tests').update({ is_active: next }).eq('id', t.id)
      if (error) throw error
      setTests((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: next } : x)))
    } catch (err: any) {
      toast.error(err.message || 'Error')
    }
  }

  async function remove(t: Test) {
    if (!confirm(`¿Eliminar la prueba "${t.name}"? Se quitará de los deportes que la usen.`)) return
    try {
      const { error } = await supabase.from('tests').delete().eq('id', t.id)
      if (error) throw error
      setTests((prev) => prev.filter((x) => x.id !== t.id))
      toast.success('Prueba eliminada')
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-4">
      {/* Crear */}
      <form onSubmit={createTest} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={creating.name}
            onChange={(e) => setCreating((p) => ({ ...p, name: e.target.value }))}
            placeholder="Nombre de la prueba (ej. CMJ)"
            className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            value={creating.description}
            onChange={(e) => setCreating((p) => ({ ...p, description: e.target.value }))}
            placeholder="Descripción (opcional)"
            className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <textarea
          value={creating.vald_interpretation_prompt}
          onChange={(e) => setCreating((p) => ({ ...p, vald_interpretation_prompt: e.target.value }))}
          placeholder="Prompt de interpretación VALD (cómo debe interpretar la IA los resultados de esta prueba)"
          rows={2}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
        />
        <button
          type="submit"
          disabled={savingNew}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {savingNew ? 'Creando...' : 'Crear prueba'}
        </button>
      </form>

      {/* Lista */}
      {tests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500">Aún no hay pruebas en el catálogo.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {tests.map((t) => (
            <div key={t.id} className="p-4">
              {editingId === t.id ? (
                <div className="space-y-2">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Descripción"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <textarea
                    value={editForm.vald_interpretation_prompt}
                    onChange={(e) => setEditForm((p) => ({ ...p, vald_interpretation_prompt: e.target.value }))}
                    placeholder="Prompt de interpretación VALD"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveEdit(t.id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-clinical-primary text-white text-xs font-medium rounded-lg">
                      <Check className="w-3.5 h-3.5" /> Guardar
                    </button>
                    <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                      {!t.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Inactiva</span>}
                      {t.vald_interpretation_prompt && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">prompt</span>}
                    </div>
                    {t.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive(t)} title={t.is_active ? 'Desactivar' : 'Activar'} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 rounded-lg">
                      {t.is_active ? 'Activa' : 'Inactiva'}
                    </button>
                    <button onClick={() => startEdit(t)} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(t)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
