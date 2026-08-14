'use client'

import { useState } from 'react'
import { Link2, Copy, Check, Send, RefreshCw, Ban, Play, Loader2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

// Base pública de los enlaces: dominio de marca si está configurado (NEXT_PUBLIC_APP_URL),
// si no el origen actual. Mismo criterio que los enlaces de anamnesis.
function publicBase(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL
  const base = env && env.trim() ? env.trim() : (typeof window !== 'undefined' ? window.location.origin : '')
  return base.replace(/\/$/, '')
}

export default function TeamInviteLink({
  teamId,
  teamName,
  initialToken,
  initialActive,
}: {
  teamId: string
  teamName: string
  initialToken: string | null
  initialActive: boolean
}) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [active, setActive] = useState<boolean>(initialActive)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const link = token ? `${publicBase()}/alta/${token}` : null

  async function call(action: string, opts?: { confirm?: string; ok?: string }) {
    if (opts?.confirm && typeof window !== 'undefined' && !window.confirm(opts.confirm)) return
    setBusy(action)
    try {
      const res = await fetch(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error')
      setToken(data.invite_token ?? null)
      setActive(!!data.invite_active)
      if (opts?.ok) toast.success(opts.ok)
    } catch (e: any) {
      toast.error(e.message || 'Error')
    } finally {
      setBusy(null)
    }
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Enlace copiado')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  function openWhatsApp() {
    if (!link) return
    const msg = encodeURIComponent(
      `¡Hola! 👋 Añade los jugadores de "${teamName}" desde este enlace (uno a uno o subiendo un Excel/CSV):\n\n${link}\n\n¡Gracias!`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const Busy = ({ a }: { a: string }) => (busy === a ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-4 sm:mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="w-4 h-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-900">Enlace de alta de jugadores</h2>
        {token && (active
          ? <span className="text-[11px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded">Activo</span>
          : <span className="text-[11px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Bloqueado</span>)}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Compártelo con alguien de fuera (delegado/entrenador) para que dé de alta jugadores en este equipo, sin cuenta.
      </p>

      {!token ? (
        <button
          onClick={() => call('generate', { ok: 'Enlace generado' })}
          disabled={busy === 'generate'}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {busy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Generar enlace
        </button>
      ) : (
        <div className="space-y-2">
          {active && (
            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
              <input readOnly value={link || ''} className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
              <button onClick={copyLink} title="Copiar" className="p-1.5 hover:bg-gray-100 rounded-lg">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {active && (
              <>
                <button onClick={openWhatsApp} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg">
                  <Send className="w-3 h-3" /> WhatsApp
                </button>
                <a href={link || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                  <ExternalLink className="w-3 h-3" /> Vista previa
                </a>
                <button onClick={() => call('block', { ok: 'Enlace bloqueado' })} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg disabled:opacity-50">
                  <Busy a="block" /><Ban className="w-3 h-3" /> Bloquear
                </button>
              </>
            )}
            {!active && (
              <button onClick={() => call('activate', { ok: 'Enlace activado' })} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                <Busy a="activate" /><Play className="w-3 h-3" /> Activar
              </button>
            )}
            <button
              onClick={() => call('regenerate', { confirm: '¿Regenerar el enlace? El enlace anterior dejará de funcionar.', ok: 'Enlace regenerado' })}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg disabled:opacity-50"
            >
              <Busy a="regenerate" /><RefreshCw className="w-3 h-3" /> Regenerar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
