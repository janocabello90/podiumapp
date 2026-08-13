import { Coins } from 'lucide-react'
import { estimateReportCost } from '@/lib/reports/aiConfig'

// Panel informativo del coste de un informe (tokens + € orientativo).
// Pensado para mostrarse SOLO a administradores. Puramente presentacional.
export default function ReportCostPanel({
  model,
  inTokens,
  outTokens,
}: {
  model: string | null
  inTokens: number
  outTokens: number
}) {
  const m = model || 'claude-sonnet-5'
  const { usd, eur, pricing } = estimateReportCost(m, inTokens, outTokens)
  const fmt = (n: number) => n.toLocaleString('es-ES')

  return (
    <div className="mb-4 sm:mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Coins className="w-4 h-4 text-gray-400" />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          Coste del informe · orientativo (solo admin)
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-gray-400">Tokens entrada</p>
          <p className="font-medium text-gray-800">{fmt(inTokens)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">Tokens salida</p>
          <p className="font-medium text-gray-800">{fmt(outTokens)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">Coste aprox.</p>
          <p className="font-semibold text-gray-900">
            ${usd.toFixed(2)} <span className="text-gray-400 font-normal">(~{eur.toFixed(2)} €)</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400">Modelo</p>
          <p className="font-medium text-gray-800 truncate" title={m}>{m}</p>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">
        {fmt(inTokens)} × ${pricing.in}/M entrada + {fmt(outTokens)} × ${pricing.out}/M salida.
      </p>
    </div>
  )
}
