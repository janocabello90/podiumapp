import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { drawJustifiedLine } from '@/lib/reports/pdfJustify'

// PDF del "Informe de Rendimiento y Prevención" (equipo). Estructura de 8 secciones.
// Las gráficas de VALD (PDF) se INCRUSTAN como punto 3, entre la intro de "Valoración
// funcional" y las interpretaciones 3.1–3.5. Se construyen dos partes con jsPDF y se
// fusionan con pdf-lib intercalando las páginas del VALD en medio.

const MARGIN_LEFT = 25
const MARGIN_RIGHT = 25
const MARGIN_TOP = 30
const MARGIN_BOTTOM = 30
const PAGE_WIDTH = 210
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const FOOTER_TEXT = 'www.clinicapodium.com  -  608392019  -  C/ Almagro 16 50004 Zaragoza'

let _logoDataUrl: string | undefined
let _logoExt: string | undefined

// Ajusta el logo dentro de una caja maxW×maxH RESPETANDO su proporción real
// (evita que salga aplastado por forzar ancho y alto fijos). Devuelve el tamaño
// final y la x centrada. Si no se puede leer la imagen, cae a la caja completa.
function fitLogo(doc: jsPDF, dataUrl: string, maxW: number, maxH: number): { w: number; h: number; x: number } {
  try {
    const p = doc.getImageProperties(dataUrl)
    const ratio = p.width / p.height
    let w = maxW, h = maxW / ratio
    if (h > maxH) { h = maxH; w = maxH * ratio }
    return { w, h, x: PAGE_WIDTH / 2 - w / 2 }
  } catch {
    return { w: maxW, h: maxH, x: PAGE_WIDTH / 2 - maxW / 2 }
  }
}

function addFooter(doc: jsPDF) {
  const h = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150)
  doc.text(FOOTER_TEXT, PAGE_WIDTH / 2, h - 12, { align: 'center' })
}
function addHeader(doc: jsPDF) {
  if (_logoDataUrl && _logoExt) {
    const { w, h, x } = fitLogo(doc, _logoDataUrl, 30, 12)
    doc.addImage(_logoDataUrl, _logoExt, x, 8, w, h)
  }
  doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, 24, PAGE_WIDTH - MARGIN_RIGHT, 24)
}
function para(doc: jsPDF, text: string, y: number, o?: { fontSize?: number; fontStyle?: string; color?: number[] }): number {
  const fs = o?.fontSize || 10, fst = o?.fontStyle || 'normal', c = o?.color || [60, 60, 60]
  const applyStyle = () => { doc.setFont('helvetica', fst); doc.setFontSize(fs); doc.setTextColor(c[0], c[1], c[2]) }
  applyStyle()
  const lines = doc.splitTextToSize(text || '—', CONTENT_WIDTH)
  const lh = fs * 0.45
  for (let i = 0; i < lines.length; i++) {
    if (y > doc.internal.pageSize.getHeight() - MARGIN_BOTTOM - 10) {
      addFooter(doc); doc.addPage(); addHeader(doc); y = MARGIN_TOP + 10
      applyStyle() // restaura tamaño/estilo/color: addFooter los dejó en 8pt gris
    }
    // Justificado en todas las líneas menos la última del párrafo (evita huecos feos al final).
    if (i < lines.length - 1) drawJustifiedLine(doc, lines[i], MARGIN_LEFT, y, CONTENT_WIDTH)
    else doc.text(lines[i], MARGIN_LEFT, y)
    y += lh
  }
  return y + 3
}
function sectionTitle(doc: jsPDF, title: string, y: number): number {
  if (y > doc.internal.pageSize.getHeight() - MARGIN_BOTTOM - 30) { addFooter(doc); doc.addPage(); addHeader(doc); y = MARGIN_TOP + 10 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30, 30, 30)
  doc.text(title, MARGIN_LEFT, y); y += 3
  doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.3); doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
  return y + 8
}
function subTitle(doc: jsPDF, title: string, y: number): number {
  if (y > doc.internal.pageSize.getHeight() - MARGIN_BOTTOM - 20) { addFooter(doc); doc.addPage(); addHeader(doc); y = MARGIN_TOP + 10 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(50, 50, 50)
  doc.text(title, MARGIN_LEFT, y); return y + 5
}
function line(doc: jsPDF, y: number): number {
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y); return y + 6
}

const SEM_LABEL: Record<string, string> = { adecuado: 'Adecuado', mejorable: 'Mejorable', prioritario: 'Prioritario' }
const SEM_RGB: Record<string, number[]> = { adecuado: [16, 185, 129], mejorable: [245, 158, 11], prioritario: [239, 68, 68] }

export async function POST(request: NextRequest) {
  try {
    const authSupabase = createServerSupabaseClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: authProfile } = await authSupabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!authProfile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { reportData, patientName, documents, clinicLogoUrl } = await request.json() as {
      reportData: any
      patientName: string
      documents?: { file_name: string; storage_path: string }[]
      clinicLogoUrl?: string | null
    }

    // Verificar propiedad de los adjuntos (evitar fuga entre clínicas)
    const paths = (documents || []).map((d) => d.storage_path).filter(Boolean)
    if (paths.length > 0) {
      const { data: owned } = await authSupabase.from('documents').select('storage_path, clinic_id').in('storage_path', paths)
      const ok = new Set((owned || []).filter((d) => d.clinic_id === authProfile.clinic_id).map((d) => d.storage_path))
      if (paths.some((p) => !ok.has(p))) return NextResponse.json({ error: 'Recursos no autorizados' }, { status: 403 })
    }

    _logoDataUrl = undefined; _logoExt = undefined
    if (clinicLogoUrl) {
      try {
        const r = await fetch(clinicLogoUrl, { signal: AbortSignal.timeout(5000) })
        if (r.ok) {
          const b = await r.arrayBuffer()
          const ct = r.headers.get('content-type') || 'image/png'
          _logoExt = ct.includes('png') || ct.includes('svg') ? 'PNG' : 'JPEG'
          _logoDataUrl = `data:${ct};base64,${Buffer.from(b).toString('base64')}`
        }
      } catch {}
    }

    const rd = reportData || {}
    const perfil = rd.perfil || {}
    const vf = rd.valoracion_funcional || {}
    const rec = rd.recomendaciones || {}
    const re = rd.resumen_ejecutivo || {}
    const sem = rd.semaforo || {}

    // ===== PARTE A: portada + perfil + anamnesis + intro de valoración funcional =====
    const docA = new jsPDF('portrait', 'mm', 'a4')
    let y = 45
    if (_logoDataUrl && _logoExt) {
      const { w, h, x } = fitLogo(docA, _logoDataUrl, 50, 25)
      docA.addImage(_logoDataUrl, _logoExt, x, 15, w, h); y = 48
    }
    docA.setDrawColor(218, 165, 32); docA.setLineWidth(0.8); docA.line(MARGIN_LEFT, y + 2, PAGE_WIDTH - MARGIN_RIGHT, y + 2)
    docA.setFont('helvetica', 'bold'); docA.setFontSize(15); docA.setTextColor(30, 30, 30)
    docA.text('INFORME DE RENDIMIENTO Y PREVENCIÓN', PAGE_WIDTH / 2, y + 16, { align: 'center' })
    docA.setFont('helvetica', 'normal'); docA.setFontSize(10); docA.setTextColor(120, 120, 120)
    docA.text('Metodología Podium®', PAGE_WIDTH / 2, y + 23, { align: 'center' })
    y = y + 34
    y = para(docA, rd.objetivo_intro || '', y)
    addFooter(docA)

    // Sección 1 — Perfil del deportista
    docA.addPage(); addHeader(docA); y = MARGIN_TOP + 10
    y = sectionTitle(docA, '1. Perfil del deportista', y)
    const perfilRows: [string, any][] = [
      ['Nombre', perfil.nombre], ['Edad', perfil.edad != null ? `${perfil.edad} años` : null], ['Sexo', perfil.sexo],
      ['Deporte', perfil.deporte], ['Posición', perfil.posicion], ['Categoría', perfil.categoria], ['Equipo', perfil.equipo],
      ['Altura / Peso', (perfil.altura_cm || perfil.peso_kg) ? `${perfil.altura_cm ?? '—'} cm / ${perfil.peso_kg ?? '—'} kg` : null],
      ['Lateralidad', perfil.lateralidad], ['Horas de entrenamiento semanales', perfil.horas_entreno_semana != null ? String(perfil.horas_entreno_semana) : null],
    ]
    for (const [k, v] of perfilRows) {
      docA.setFont('helvetica', 'bold'); docA.setFontSize(9); docA.setTextColor(70, 70, 70); docA.text(`${k}:`, MARGIN_LEFT, y)
      docA.setFont('helvetica', 'normal'); docA.setTextColor(40, 40, 40); docA.text(String(v || '—'), MARGIN_LEFT + 70, y)
      y += 6
    }
    addFooter(docA)

    // Sección 2 — Anamnesis deportiva
    docA.addPage(); addHeader(docA); y = MARGIN_TOP + 10
    y = sectionTitle(docA, '2. Anamnesis deportiva', y)
    y = para(docA, rd.resumen_anamnesis || '', y)
    addFooter(docA)

    // Sección 3 — Valoración funcional (intro) → aquí van las gráficas de VALD
    docA.addPage(); addHeader(docA); y = MARGIN_TOP + 10
    y = sectionTitle(docA, '3. Valoración funcional', y)
    y = para(docA, vf.introduccion || '', y, { fontStyle: 'italic' })
    y += 2
    para(docA, 'A continuación se muestran las gráficas de la valoración funcional (VALD). La interpretación por áreas continúa tras las gráficas.', y, { fontSize: 9, color: [120, 120, 120] })
    addFooter(docA)
    const partA = Buffer.from(docA.output('arraybuffer'))

    // ===== PARTE B: interpretación 3.1-3.5 + hallazgos + semáforo + conclusiones + recomendaciones + resumen + descargo =====
    const docB = new jsPDF('portrait', 'mm', 'a4')
    addHeader(docB); y = MARGIN_TOP + 10
    y = sectionTitle(docB, 'Valoración funcional — interpretación', y)
    const sub = (label: string, txt: string) => { y = subTitle(docB, label, y); y = para(docB, txt || '', y); y += 1 }
    sub('3.1 Calidad del movimiento', vf.calidad_movimiento)
    sub('3.2 Movilidad', vf.movilidad)
    sub('3.3 Fuerza', vf.fuerza)
    sub('3.4 Potencia', vf.potencia)
    sub('3.5 Capacidad reactiva', vf.capacidad_reactiva)
    addFooter(docB)

    docB.addPage(); addHeader(docB); y = MARGIN_TOP + 10
    y = sectionTitle(docB, '4. Hallazgos principales', y)
    y = para(docB, rd.hallazgos || '', y)
    addFooter(docB)

    // Sección 5 — Semáforo funcional
    docB.addPage(); addHeader(docB); y = MARGIN_TOP + 10
    y = sectionTitle(docB, '5. Semáforo funcional', y)
    const areas: [string, string][] = [
      ['Movilidad', sem.movilidad], ['Fuerza', sem.fuerza], ['Potencia', sem.potencia],
      ['Control motor', sem.control_motor], ['Capacidad reactiva', sem.capacidad_reactiva], ['Simetría', sem.simetria],
    ]
    for (const [label, val] of areas) {
      const key = String(val || 'mejorable')
      const rgb = SEM_RGB[key] || [156, 163, 175]
      docB.setFillColor(rgb[0], rgb[1], rgb[2]); docB.circle(MARGIN_LEFT + 2, y - 1.2, 1.8, 'F')
      docB.setFont('helvetica', 'normal'); docB.setFontSize(10); docB.setTextColor(50, 50, 50)
      docB.text(label, MARGIN_LEFT + 8, y)
      docB.setFont('helvetica', 'bold'); docB.setTextColor(rgb[0], rgb[1], rgb[2])
      docB.text(SEM_LABEL[key] || key, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' })
      y += 8
    }
    y += 2
    para(docB, 'Clasificación:  Adecuado · Mejorable · Prioritario.', y, { fontSize: 8, color: [130, 130, 130] })
    addFooter(docB)

    docB.addPage(); addHeader(docB); y = MARGIN_TOP + 10
    y = sectionTitle(docB, '6. Conclusiones', y)
    y = para(docB, rd.conclusiones || '', y)
    addFooter(docB)

    docB.addPage(); addHeader(docB); y = MARGIN_TOP + 10
    y = sectionTitle(docB, '7. Recomendaciones', y)
    const recSub = (label: string, txt: string) => { y = subTitle(docB, label, y); y = para(docB, txt || '', y); y += 1 }
    recSub('Capacidades prioritarias a desarrollar', rec.capacidades_prioritarias)
    recSub('Aspectos a monitorizar', rec.aspectos_monitorizar)
    recSub('Recomendaciones para el cuerpo técnico', rec.cuerpo_tecnico)
    recSub('Siguiente valoración funcional', rec.siguiente_valoracion)
    addFooter(docB)

    docB.addPage(); addHeader(docB); y = MARGIN_TOP + 10
    y = sectionTitle(docB, '8. Resumen ejecutivo', y)
    recSub('Fortalezas', re.fortalezas)
    recSub('Aspectos a mejorar', re.aspectos_mejorar)
    recSub('Riesgo funcional', re.riesgo_funcional)
    recSub('Objetivo principal', re.objetivo_principal)
    y += 4
    y = line(docB, y)
    y = para(docB, 'Descargo de responsabilidad:', y, { fontStyle: 'bolditalic', fontSize: 9, color: [100, 100, 100] })
    y = para(docB, rd.descargo || '', y, { fontStyle: 'italic', fontSize: 8, color: [120, 120, 120] })
    addFooter(docB)
    const partB = Buffer.from(docB.output('arraybuffer'))

    // ===== FUSIÓN: A + gráficas VALD + B =====
    const out = await PDFDocument.create()
    const pdfA = await PDFDocument.load(partA)
    ;(await out.copyPages(pdfA, pdfA.getPageIndices())).forEach((p) => out.addPage(p))

    // Incrustar las páginas del/los PDF de VALD como punto 3
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (serviceRoleKey && supabaseUrl && (documents || []).length > 0) {
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      for (const d of documents!) {
        if (!/\.pdf$/i.test(d.file_name || '')) continue
        try {
          const { data: fileData, error } = await admin.storage.from('documents').download(d.storage_path)
          if (error || !fileData) continue
          const bytes = await fileData.arrayBuffer()
          const vald = await PDFDocument.load(bytes)
          ;(await out.copyPages(vald, vald.getPageIndices())).forEach((p) => out.addPage(p))
        } catch (e) {
          console.error('VALD merge error:', e)
        }
      }
    }

    const pdfB = await PDFDocument.load(partB)
    ;(await out.copyPages(pdfB, pdfB.getPageIndices())).forEach((p) => out.addPage(p))

    const bytes = await out.save()
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Informe_Rendimiento_${(patientName || 'deportista').replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Team PDF export error:', error)
    return NextResponse.json({ error: error.message || 'Error al generar PDF' }, { status: 500 })
  }
}
