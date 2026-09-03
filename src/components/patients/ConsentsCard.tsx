'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
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
  const [showAccept, setShowAccept] = useState(false)

  // Tipos aplicables según el paciente (equipo añade club/imagen, opcionales).
  const applicable = isTeam ? [...OBLIGATORIOS, ...VOLUNTARIOS] : OBLIGATORIOS
  const [selected, setSelected] = useState<Set<string>>(new Set(OBLIGATORIOS))
  const toggleSel = (t: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(t)) next.delete(t); else next.add(t)
    return next
  })

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

  async function saveAccept() {
    const types = Array.from(selected)
    if (!types.length) { toast.error('Selecciona al menos un consentimiento'); return }
    setBusy('accept')
    try {
      const res = await fetch('/api/consents/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, types }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo registrar')
      toast.success('Consentimiento registrado en consulta')
      setShowAccept(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'No se pudo registrar')
    } finally {
      setBusy(null)
    }
  }

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

      {consents.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no hay consentimientos registrados.</p>
      ) : (
        <ul className="space-y-3">
          {consents.map((c) => {
            const revoked = !!c.revoked_at
            const inPerson = c.metadata?.source === 'in_person'
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
                  {inPerson && <span className="text-gray-400">· en consulta</span>}
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
      )}

      {/* Registrar aceptación presencial */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        {!showAccept ? (
          <button
            onClick={() => setShowAccept(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <Plus className="w-3.5 h-3.5" /> Registrar consentimiento (en consulta)
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Marca los consentimientos que el paciente acepta ahora en consulta. Quedará registrada la aceptación con la fecha de hoy y una copia del texto vigente.
            </p>
            <div className="space-y-1.5">
              {applicable.map((t) => {
                const obligatorio = OBLIGATORIOS.includes(t)
                return (
                  <label key={t} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(t)}
                      onChange={() => toggleSel(t)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{consentLabel(t)}</span>
                    <span className="text-xs text-gray-400">{obligatorio ? '· obligatorio' : '· opcional'}</span>
                  </label>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveAccept}
                disabled={busy === 'accept'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {busy === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Registrar
              </button>
              <button
                onClick={() => setShowAccept(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
