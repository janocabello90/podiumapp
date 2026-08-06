'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { consentLabel } from '@/lib/clinical/consents'

type Consent = {
  id: string
  type: string
  granted: boolean
  granted_at: string | null
  revoked_at: string | null
  metadata?: any
}

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('es-ES') : ''
}

export default function ConsentsCard({
  consents,
  representative,
}: {
  consents: Consent[]
  representative?: { name?: string; dni?: string; relation?: string }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function toggleRevoke(c: Consent) {
    const revoke = !c.revoked_at
    if (revoke && typeof window !== 'undefined' && !window.confirm(`¿Registrar que el paciente RETIRA el consentimiento «${consentLabel(c.type)}»? Quedará constancia de que lo aceptó y luego lo revocó.`)) return
    setBusy(c.id)
    try {
      const res = await fetch('/api/consents/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentId: c.id, revoke }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar')
      toast.success(revoke ? 'Consentimiento revocado' : 'Consentimiento reactivado')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'No se pudo actualizar')
    } finally {
      setBusy(null)
    }
  }

  if (consents.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Consentimientos</h3>
      {representative && (
        <div className="mb-3 text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
          Menor de edad · otorgados por su representante legal
          {representative.name ? `: ${representative.name}` : ''}
          {representative.relation ? ` (${representative.relation})` : ''}
          {representative.dni ? ` · DNI ${representative.dni}` : ''}
        </div>
      )}
      <ul className="space-y-3">
        {consents.map((c) => {
          const revoked = !!c.revoked_at
          const channels = c.type === 'image_rights' && Array.isArray(c.metadata?.channels) ? c.metadata.channels : null
          return (
            <li key={c.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 truncate">{consentLabel(c.type)}</span>
                {!revoked && c.granted && (
                  <button
                    onClick={() => toggleRevoke(c)}
                    disabled={busy === c.id}
                    className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 inline-flex items-center gap-1 flex-shrink-0"
                    title="El paciente retira este consentimiento"
                  >
                    {busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Revocar
                  </button>
                )}
                {revoked && (
                  <button
                    onClick={() => toggleRevoke(c)}
                    disabled={busy === c.id}
                    className="text-xs text-gray-400 hover:text-green-600 disabled:opacity-50 inline-flex items-center gap-1 flex-shrink-0"
                    title="Deshacer la revocación"
                  >
                    {busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Reactivar
                  </button>
                )}
              </div>
              {/* Historial: aceptado / rechazado y, si procede, revocado */}
              <div className="mt-0.5 flex items-center gap-2 flex-wrap text-xs">
                {c.granted ? (
                  <span className="text-green-600">Aceptado {fmt(c.granted_at)}</span>
                ) : (
                  <span className="text-red-500">Rechazado {fmt(c.granted_at)}</span>
                )}
                {revoked && (
                  <>
                    <span className="text-gray-300">→</span>
                    <span className="text-red-600 font-medium">Revocado {fmt(c.revoked_at)}</span>
                  </>
                )}
              </div>
              {channels && (
                <p className="text-xs text-gray-400 mt-0.5">Soportes: {channels.join(', ')}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
