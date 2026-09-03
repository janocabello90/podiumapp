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

const OBLIGATORIOS = ['data_processing', 'info_treatment', 'ai_analysis']
const VOLUNTARIOS = ['report_sharing_club', 'image_rights']

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('es-ES') : ''
}

export default function ConsentsCard({
  consents,
  representative,
  patientId,
  isTeam = false,
}: {
  consents: Consent[]
  representative?: { name?: string; dni?: string; relation?: string }
  patientId: string
  isTeam?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // Tipos a mostrar: los aplicables (equipo añade club/imagen) + los ya registrados.
  const applicable = isTeam ? [...OBLIGATORIOS, ...VOLUNTARIOS] : OBLIGATORIOS
  const byType = new Map(consents.map((c) => [c.type, c]))
  const types = Array.from(new Set([...applicable, ...consents.map((c) => c.type)]))

  // Revocar / reactivar un consentimiento existente (aceptado ↔ revocado).
  async function toggleRevoke(c: Consent) {
    const revoke = !c.revoked_at
    if (revoke && typeof window !== 'undefined' && !window.confirm(`¿Registrar que el paciente RETIRA el consentimiento «${consentLabel(c.type)}»? Quedará constancia de que lo aceptó y luego lo revocó.`)) return
    setBusy(c.type)
    try {
      const res = await fetch('/api/consents/revoke', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  // Registrar la aceptación en consulta de un consentimiento no aceptado.
  async function acceptOne(type: string) {
    setBusy(type)
    try {
      const res = await fetch('/api/consents/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, types: [type] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo registrar')
      toast.success('Consentimiento aceptado en consulta')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'No se pudo registrar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Consentimientos</h3>
      <p className="text-xs text-gray-400 mb-3">Acepta o revoca según lo que indique el paciente en consulta.</p>
      {representative && (
        <div className="mb-3 text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
          Menor de edad · otorgados por su representante legal
          {representative.name ? `: ${representative.name}` : ''}
          {representative.relation ? ` (${representative.relation})` : ''}
          {representative.dni ? ` · DNI ${representative.dni}` : ''}
        </div>
      )}
      <ul className="space-y-3">
        {types.map((type) => {
          const c = byType.get(type)
          const revoked = !!c?.revoked_at
          const state = !c ? 'pendiente' : revoked ? 'revocado' : c.granted ? 'aceptado' : 'rechazado'
          const inPerson = c?.metadata?.source === 'in_person'
          const voluntario = VOLUNTARIOS.includes(type)
          const channels = type === 'image_rights' && Array.isArray(c?.metadata?.channels) ? c!.metadata.channels : null
          const isBusy = busy === type
          return (
            <li key={type} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 truncate">
                  {consentLabel(type)}
                  {voluntario && <span className="text-xs text-gray-400"> · opcional</span>}
                </span>
                {/* Acción inline según estado */}
                {state === 'aceptado' && (
                  <button onClick={() => toggleRevoke(c!)} disabled={isBusy}
                    className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 inline-flex items-center gap-1 flex-shrink-0"
                    title="El paciente retira este consentimiento">
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Revocar
                  </button>
                )}
                {state === 'revocado' && (
                  <button onClick={() => toggleRevoke(c!)} disabled={isBusy}
                    className="text-xs text-gray-400 hover:text-green-600 disabled:opacity-50 inline-flex items-center gap-1 flex-shrink-0"
                    title="Deshacer la revocación">
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Reactivar
                  </button>
                )}
                {(state === 'pendiente' || state === 'rechazado') && (
                  <button onClick={() => acceptOne(type)} disabled={isBusy}
                    className="text-xs text-gray-400 hover:text-green-600 disabled:opacity-50 inline-flex items-center gap-1 flex-shrink-0"
                    title="Registrar la aceptación en consulta">
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Aceptar
                  </button>
                )}
              </div>
              {/* Estado */}
              <div className="mt-0.5 flex items-center gap-2 flex-wrap text-xs">
                {state === 'pendiente' ? (
                  <span className="text-gray-400">Pendiente</span>
                ) : c!.granted ? (
                  <span className="text-green-600">Aceptado {fmt(c!.granted_at)}</span>
                ) : (
                  <span className="text-red-500">Rechazado {fmt(c!.granted_at)}</span>
                )}
                {inPerson && state !== 'pendiente' && <span className="text-gray-400">· en consulta</span>}
                {revoked && (
                  <>
                    <span className="text-gray-300">→</span>
                    <span className="text-red-600 font-medium">Revocado {fmt(c!.revoked_at)}</span>
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
