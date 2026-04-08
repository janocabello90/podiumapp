'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function DeletePatientButton({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    const confirmed = confirm(
      `¿Estás seguro de que quieres eliminar a "${patientName}" y TODOS sus datos (anamnesis, valoración, informes, imágenes)?\n\nEsta acción no se puede deshacer.`
    )
    if (!confirmed) return

    // Double confirmation for safety
    const doubleConfirm = confirm(
      `Confirma de nuevo: se eliminarán permanentemente todos los datos de "${patientName}" en cumplimiento del derecho de supresión (RGPD).`
    )
    if (!doubleConfirm) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/patients/${patientId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')

      toast.success(data.message || 'Paciente eliminado')
      router.push('/patients')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar paciente')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
      title="Eliminar paciente y todos sus datos"
    >
      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      Eliminar paciente
    </button>
  )
}
