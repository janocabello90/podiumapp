'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  patient: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    date_of_birth: string | null
    gender: string | null
    notes: string | null
  }
}

// Editar los datos básicos de un paciente (por si el alta se hizo con una errata).
// Actualiza directamente con el cliente autenticado (RLS clínica-scoped).
export default function EditPatientButton({ patient }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: patient.full_name || '',
    email: patient.email || '',
    phone: patient.phone || '',
    date_of_birth: patient.date_of_birth || '',
    gender: patient.gender || '',
    notes: patient.notes || '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('patients').update({
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        notes: form.notes.trim() || null,
      }).eq('id', patient.id)
      if (error) throw error
      toast.success('Datos actualizados')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
        title="Editar datos del paciente"
      >
        <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">Editar datos</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Editar datos</h2>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo *</label>
                <input
                  type="text" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                  <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de nacimiento</label>
                  <input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sexo</label>
                  <select value={form.gender} onChange={(e) => set('gender', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white">
                    <option value="">Seleccionar</option>
                    <option value="male">Masculino</option>
                    <option value="female">Femenino</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas internas</label>
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none" />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 bg-clinical-primary hover:bg-clinical-navy text-white font-medium rounded-xl transition-colors disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
