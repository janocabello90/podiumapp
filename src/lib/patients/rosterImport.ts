// Borrador de paciente derivado de una fila del fichero (mismos campos que el alta individual).
export interface PatientDraft {
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null // ISO yyyy-mm-dd
  gender: string | null // 'male' | 'female' | null
  notes: string | null
}

export interface ParsedRow {
  index: number // 1-based, para mensajes al usuario
  draft: PatientDraft
  errors: string[]
}

// Alias de cabeceras aceptados (normalizados: minúsculas, sin tildes).
const FIELD_ALIASES: Record<keyof PatientDraft, string[]> = {
  full_name: ['nombre', 'full_name', 'nombre completo', 'nombre y apellidos', 'jugador', 'nombreyapellidos'],
  email: ['email', 'correo', 'correo electronico', 'e-mail', 'mail'],
  phone: ['telefono', 'phone', 'movil', 'tel', 'teléfono', 'móvil'],
  date_of_birth: ['fecha_nacimiento', 'nacimiento', 'date_of_birth', 'fecha de nacimiento', 'fecha nacimiento', 'dob', 'fecha_de_nacimiento'],
  gender: ['sexo', 'genero', 'gender', 'género'],
  notes: ['notas', 'notes', 'observaciones', 'comentarios'],
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MALE_WORDS = ['hombre', 'masculino', 'varon', 'male']
const FEMALE_WORDS = ['mujer', 'femenino', 'female']

export function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// --- Parseo CSV (comillas dobles, comas entrecomilladas, ; fallback de Excel-ES) ---
export function parseCsv(text: string): string[][] {
  // Quitar BOM.
  const clean = text.replace(/^﻿/, '')
  // Detectar separador por la primera línea.
  const firstLine = clean.split(/\r?\n/, 1)[0] || ''
  const commas = (firstLine.match(/,/g) || []).length
  const semis = (firstLine.match(/;/g) || []).length
  const delim = semis > commas ? ';' : ','

  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ } // comilla escapada
        else inQuotes = false
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === delim) { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* ignora */ }
      else field += c
    }
  }
  // Último campo/fila.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  // Descartar filas totalmente vacías.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// --- Parseo XLSX (primera hoja → matriz de strings). Carga `xlsx` bajo demanda. ---
export async function parseXlsx(data: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(data, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  return (rows as any[][])
    .map((r) => r.map((c) => (c == null ? '' : String(c))))
    .filter((r) => r.some((cell) => cell.trim() !== ''))
}

// Mapea la fila de cabeceras a índices de columna por campo.
export function mapHeaders(headerRow: string[]): Partial<Record<keyof PatientDraft, number>> {
  const map: Partial<Record<keyof PatientDraft, number>> = {}
  headerRow.forEach((h, idx) => {
    const n = normalize(h)
    for (const field of Object.keys(FIELD_ALIASES) as (keyof PatientDraft)[]) {
      if (map[field] === undefined && FIELD_ALIASES[field].includes(n)) {
        map[field] = idx
      }
    }
  })
  return map
}

function parseDate(value: string): { iso: string | null; ok: boolean } {
  const v = value.trim()
  if (!v) return { iso: null, ok: true }
  // yyyy-mm-dd
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m
    return { iso: `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`, ok: true }
  }
  // dd/mm/yyyy o dd-mm-yyyy
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return { iso: `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`, ok: true }
  }
  return { iso: null, ok: false }
}

function parseGender(value: string): string | null {
  const n = normalize(value)
  if (!n) return null
  if (MALE_WORDS.includes(n) || n === 'h') return 'male'
  if (FEMALE_WORDS.includes(n) || n === 'm' || n === 'f') return 'female'
  return null // no reconocido → se ignora (campo opcional)
}

// Valida una fila de datos (ya separada en celdas) según el mapeo de cabeceras.
export function validateRow(cells: string[], map: Partial<Record<keyof PatientDraft, number>>, index: number): ParsedRow {
  const get = (field: keyof PatientDraft) => {
    const idx = map[field]
    return idx === undefined ? '' : (cells[idx] || '').trim()
  }

  const errors: string[] = []
  const full_name = get('full_name')
  if (!full_name) errors.push('Falta el nombre')

  const emailRaw = get('email')
  let email: string | null = null
  if (emailRaw) {
    if (EMAIL_RE.test(emailRaw)) email = emailRaw
    else errors.push('Email no válido')
  }

  const dobRaw = get('date_of_birth')
  const { iso: date_of_birth, ok: dobOk } = parseDate(dobRaw)
  if (!dobOk) errors.push('Fecha de nacimiento no válida')

  const draft: PatientDraft = {
    full_name,
    email,
    phone: get('phone') || null,
    date_of_birth,
    gender: parseGender(get('gender')),
    notes: get('notes') || null,
  }

  return { index, draft, errors }
}

// Convierte una tabla (incl. cabecera) en filas parseadas. Devuelve también el mapeo detectado.
export function tableToRows(table: string[][]): { map: Partial<Record<keyof PatientDraft, number>>; rows: ParsedRow[] } {
  if (table.length === 0) return { map: {}, rows: [] }
  const [header, ...body] = table
  const map = mapHeaders(header)
  const rows = body.map((cells, i) => validateRow(cells, map, i + 1))
  return { map, rows }
}

// Plantilla CSV de ejemplo con todas las cabeceras.
export function buildTemplateCsv(): string {
  const header = 'nombre,email,telefono,fecha_nacimiento,sexo,notas'
  const example = 'Pedro García López,pedro@email.com,600111222,15/03/2005,hombre,Extremo derecho'
  return `${header}\n${example}\n`
}
