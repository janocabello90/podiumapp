'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Panel de "Generando…" con polling. Cuando el informe deja de estar 'generating',
// refresca la página (que ya mostrará el editor si pasó a draft, o el error).
export default function GeneratingPanel({ reportId }: { reportId: string }) {
  const router = useRouter()

  useEffect(() => {
    let stop = false
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data.status && data.status !== 'generating' && !stop) {
          stop = true
          clearInterval(iv)
          if (data.status === 'draft') toast.success('Informe listo')
          router.refresh()
        }
      } catch {
        /* reintenta en el siguiente tick */
      }
    }, 4000)
    return () => { stop = true; clearInterval(iv) }
  }, [reportId, router])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
      <Loader2 className="w-8 h-8 text-blue-500 mx-auto animate-spin" />
      <h2 className="text-base font-semibold text-gray-900">Generando informe…</h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto">
        Puedes <strong>cerrar la página</strong>; el informe seguirá generándose en segundo plano.
        Al volver estará listo.
      </p>
    </div>
  )
}
