'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Download, Loader2, Check, AlertTriangle, X, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  parseCsv,
  parseXlsx,
  tableToRows,
  buildTemplateCsv,
  normalize,
  type ParsedRow,
} from '@/lib/patients/rosterImport'

interface Props {
  teamId: string
  clinicId: string
  existingEmails: string[] // emails de los jugadores actuales del equipo (normalizados)
}

type RowState = 'valid' | 'duplicate' | 'error'

interface PreviewRow extends ParsedRow {
  state: RowState
  reason: string
  include: boolean
}

export default function BulkImportPlayers({ teamId, clinicId, existingEmails }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  const teamEmailSet = new Set(existingEmails)

  function classify(parsed: ParsedRow[]): PreviewRow[] {
    const seenEmails = new Set<string>()
    return parsed.map((r) => {
      if (r.errors.length > 0) {
        return { ...r, state: 'error' as RowState, reason: r.errors.join('; '), include: false }
      }
      const email = r.draft.email ? normalize(r.draft.email) : ''
      if (email) {
        if (teamEmailSet.has(email)) {
          return { ...r, state: 'duplicate' as RowState, reason: 'Email ya en el equipo', include: false }
        }
        if (seenEmails.has(email)) {
          return { ...r, state: 'duplicate' as RowState, reason: 'Email repetido en el fichero', include: false }
        }
        seenEmails.add(email)
      }
      return { ...r, state: 'valid' as RowState, reason: '', include: true }
    })
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    try {
      let table: string[][]
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        table = await parseXlsx(await file.arrayBuffer())
      } else {
        table = parseCsv(await file.text())
      }
      const { map, rows: parsed } = tableToRows(table)
      if (map.full_name === undefined) {
        toast.error('No se encontró la columna "nombre". Descarga la plantilla.')
        setRows([])
        return
      }
      if (parsed.length === 0) {
        toast.error('El fichero no tiene filas de datos')
        setRows([])
        return
      }
      setRows(classify(parsed))
    } catch (err: any) {
      console.error(err)
      toast.error('No se pudo leer el fichero')
      setRows([])
    }
  }

  function toggleInclude(index: number) {
    setRows((prev) => prev.map((r) => (r.index === index && r.state !== 'error' ? { ...r, include: !r.include } : r)))
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_jugadores.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    const toInsert = rows.filter((r) => r.include && r.state !== 'error')
    if (toInsert.length === 0) {
      toast.error('No hay filas para importar')
      return
    }
    setImporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const payload = toInsert.map((r) => ({
        clinic_id: clinicId,
        created_by: user.id,
        team_id: teamId,
        status: 'active',
        full_name: r.draft.full_name,
        email: r.draft.email,
        phone: r.draft.phone,
        date_of_birth: r.draft.date_of_birth,
        gender: r.draft.gender,
        notes: r.draft.notes,
      }))

      const { data, error } = await supabase.from('patients').insert(payload).select('id')
      if (error) throw error

      toast.success(`${data?.length ?? toInsert.length} jugador(es) importado(s)`)
      setOpen(false)
      setRows([])
      setFileName('')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al importar')
    }
    setImporting(false)
  }

  const counts = {
    valid: rows.filter((r) => r.state === 'valid').length,
    duplicate: rows.filter((r) => r.state === 'duplicate').length,
    error: rows.filter((r) => r.state === 'error').length,
  }
  const willImport = rows.filter((r) => r.include && r.state !== 'error').length

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors flex-shrink-0"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Importar CSV/Excel</span>
        <span className="sm:hidden">Importar</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl my-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Importar jugadores</h2>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Acciones de carga */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-sm font-medium rounded-lg"
            >
              <Upload className="w-4 h-4" /> Elegir fichero
            </button>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg"
            >
              <Download className="w-4 h-4" /> Plantilla
            </button>
            {fileName && <span className="text-xs text-gray-500 truncate">{fileName}</span>}
          </div>

          <p className="text-xs text-gray-400">
            Columnas: nombre (obligatorio), email, teléfono, fecha_nacimiento (dd/mm/aaaa o aaaa-mm-dd), sexo, notas. Formatos .csv y .xlsx.
          </p>

          {/* Previsualización */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-green-600"><Check className="w-3.5 h-3.5" /> {counts.valid} válidas</span>
                <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> {counts.duplicate} duplicadas</span>
                <span className="inline-flex items-center gap-1 text-red-500"><X className="w-3.5 h-3.5" /> {counts.error} con error</span>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 w-8"></th>
                      <th className="text-left px-3 py-2">Nombre</th>
                      <th className="text-left px-3 py-2">Email</th>
                      <th className="text-left px-3 py-2">Nac.</th>
                      <th className="text-left px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r) => (
                      <tr key={r.index} className={r.state === 'error' ? 'bg-red-50/40' : r.state === 'duplicate' ? 'bg-amber-50/40' : ''}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={r.include}
                            disabled={r.state === 'error'}
                            onChange={() => toggleInclude(r.index)}
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-800">{r.draft.full_name || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-gray-500">{r.draft.email || ''}</td>
                        <td className="px-3 py-2 text-gray-500">{r.draft.date_of_birth || ''}</td>
                        <td className="px-3 py-2">
                          {r.state === 'valid' && <span className="text-green-600">Válida</span>}
                          {r.state === 'duplicate' && <span className="text-amber-600">{r.reason}</span>}
                          {r.state === 'error' && <span className="text-red-500">{r.reason}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-500">{willImport} se importarán</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
            <button
              onClick={handleImport}
              disabled={importing || willImport === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Importar {willImport > 0 ? `(${willImport})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
