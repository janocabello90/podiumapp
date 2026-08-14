'use client'

import { useRef, useState } from 'react'
import { Upload, Download, Plus, Trash2, Loader2, Check, AlertTriangle, X, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  parseCsv,
  parseXlsx,
  tableToRows,
  buildTemplateCsv,
  templateTable,
  type ParsedRow,
} from '@/lib/patients/rosterImport'

interface ManualRow {
  full_name: string
  email: string
  phone: string
  date_of_birth: string
  gender: string
  notes: string
}
const emptyRow = (): ManualRow => ({ full_name: '', email: '', phone: '', date_of_birth: '', gender: '', notes: '' })

export default function TeamInvitePublicForm({ token, teamName }: { token: string; teamName: string }) {
  const [mode, setMode] = useState<'manual' | 'file'>('manual')
  const [rows, setRows] = useState<ManualRow[]>([emptyRow()])
  const [fileRows, setFileRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ added: number; omitidos: number; errores: { fila: number; motivo: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Manual ---
  function updateRow(i: number, patch: Partial<ManualRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() { setRows((prev) => [...prev, emptyRow()]) }
  function removeRow(i: number) { setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)) }

  // --- Fichero ---
  async function handleFile(file: File) {
    setFileName(file.name)
    try {
      const table = file.name.toLowerCase().endsWith('.xlsx')
        ? await parseXlsx(await file.arrayBuffer())
        : parseCsv(await file.text())
      const { map, rows: parsed } = tableToRows(table)
      if (map.full_name === undefined) { toast.error('No se encontró la columna "nombre". Descarga la plantilla.'); setFileRows([]); return }
      if (parsed.length === 0) { toast.error('El fichero no tiene filas de datos'); setFileRows([]); return }
      setFileRows(parsed)
    } catch {
      toast.error('No se pudo leer el fichero')
      setFileRows([])
    }
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }
  function downloadCsv() { triggerDownload(new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' }), 'plantilla_jugadores.csv') }
  async function downloadXlsx() {
    try {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.aoa_to_sheet(templateTable())
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Jugadores')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      triggerDownload(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'plantilla_jugadores.xlsx')
    } catch { toast.error('No se pudo generar la plantilla Excel') }
  }

  // --- Envío ---
  async function submit() {
    const players = mode === 'manual'
      ? rows.filter((r) => r.full_name.trim()).map((r) => ({
          full_name: r.full_name.trim(), email: r.email.trim() || null, phone: r.phone.trim() || null,
          date_of_birth: r.date_of_birth || null, gender: r.gender || null, notes: r.notes.trim() || null,
        }))
      : fileRows.filter((r) => r.errors.length === 0).map((r) => r.draft)

    if (players.length === 0) { toast.error('Añade al menos un jugador'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/team-invite/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ players }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error al enviar')
      setResult(data)
      setRows([emptyRow()]); setFileRows([]); setFileName('')
    } catch (e: any) {
      toast.error(e.message || 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }

  const fileValid = fileRows.filter((r) => r.errors.length === 0).length
  const fileErr = fileRows.length - fileValid
  const input = 'w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-200'

  // Panel de confirmación tras enviar.
  if (result) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-green-50 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">¡Listo!</h2>
        <p className="text-sm text-gray-600">
          <strong>{result.added}</strong> jugador{result.added !== 1 ? 'es' : ''} añadido{result.added !== 1 ? 's' : ''} a <strong>{teamName}</strong>
          {result.omitidos > 0 && <> · {result.omitidos} ya existía{result.omitidos !== 1 ? 'n' : ''}</>}
          {result.errores.length > 0 && <> · {result.errores.length} con error</>}.
        </p>
        {result.errores.length > 0 && (
          <ul className="text-xs text-red-600 text-left inline-block">
            {result.errores.slice(0, 8).map((e, i) => <li key={i}>Fila {e.fila}: {e.motivo}</li>)}
          </ul>
        )}
        <div>
          <button onClick={() => setResult(null)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
            <UserPlus className="w-4 h-4" /> Añadir más jugadores
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['manual', 'file'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {m === 'manual' ? 'Uno a uno' : 'Subir CSV/Excel'}
          </button>
        ))}
      </div>

      {mode === 'manual' ? (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start border border-gray-100 rounded-xl p-3">
              <input className={`${input} sm:col-span-4`} placeholder="Nombre y apellidos *" value={r.full_name} onChange={(e) => updateRow(i, { full_name: e.target.value })} />
              <input className={`${input} sm:col-span-3`} placeholder="Email" value={r.email} onChange={(e) => updateRow(i, { email: e.target.value })} />
              <input className={`${input} sm:col-span-2`} placeholder="Teléfono" value={r.phone} onChange={(e) => updateRow(i, { phone: e.target.value })} />
              <input className={`${input} sm:col-span-2`} type="date" value={r.date_of_birth} onChange={(e) => updateRow(i, { date_of_birth: e.target.value })} />
              <div className="sm:col-span-1 flex items-center justify-end">
                <button onClick={() => removeRow(i)} className="p-1.5 text-gray-400 hover:text-red-500" title="Quitar"><Trash2 className="w-4 h-4" /></button>
              </div>
              <select className={`${input} sm:col-span-3`} value={r.gender} onChange={(e) => updateRow(i, { gender: e.target.value })}>
                <option value="">Sexo (opcional)</option>
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
              </select>
              <input className={`${input} sm:col-span-9`} placeholder="Notas (posición, etc.)" value={r.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
            </div>
          ))}
          <button onClick={addRow} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
            <Plus className="w-4 h-4" /> Añadir otro jugador
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-lg">
              <Upload className="w-4 h-4" /> Elegir fichero
            </button>
            <button onClick={downloadCsv} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg"><Download className="w-4 h-4" /> Plantilla CSV</button>
            <button onClick={downloadXlsx} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg"><Download className="w-4 h-4" /> Plantilla Excel</button>
            {fileName && <span className="text-xs text-gray-500 truncate">{fileName}</span>}
          </div>
          <p className="text-xs text-gray-400">Columnas: nombre (obligatorio), email, teléfono, fecha_nacimiento (dd/mm/aaaa o aaaa-mm-dd), sexo, notas.</p>
          {fileRows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-green-600"><Check className="w-3.5 h-3.5" /> {fileValid} válidas</span>
                {fileErr > 0 && <span className="inline-flex items-center gap-1 text-red-500"><X className="w-3.5 h-3.5" /> {fileErr} con error</span>}
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0"><tr>
                    <th className="text-left px-3 py-2">Nombre</th><th className="text-left px-3 py-2">Email</th><th className="text-left px-3 py-2">Estado</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {fileRows.map((r) => (
                      <tr key={r.index} className={r.errors.length ? 'bg-red-50/40' : ''}>
                        <td className="px-3 py-2 text-gray-800">{r.draft.full_name || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-gray-500">{r.draft.email || ''}</td>
                        <td className="px-3 py-2">{r.errors.length ? <span className="text-red-500">{r.errors.join('; ')}</span> : <span className="text-green-600">Válida</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-400">Los duplicados (por email) se detectan al enviar.</span>
        <button onClick={submit} disabled={submitting}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enviar
        </button>
      </div>
    </div>
  )
}
