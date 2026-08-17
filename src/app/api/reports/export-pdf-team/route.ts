import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { drawJustifiedLine } from '@/lib/reports/pdfJustify'
import { METODOLOGIA_JPEG_BASE64 } from '@/lib/reports/metodologiaAsset'
import { parseMetricsSchema, type MetricDef } from '@/lib/reports/metrics'

// PDF del "Informe de Rendimiento y Prevención" (equipo). Estructura de 6 secciones
// (perfil, anamnesis, valoración funcional, hallazgos, conclusiones, recomendaciones).
// El cuerpo narrativo se construye con jsPDF; las gráficas de VALD (PDF) se añaden con
// pdf-lib como ANEXO al final del documento (tras la página de metodología).

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
    // Justificar solo líneas "llenas": ni la última del texto ni la última de un párrafo
    // (la siguiente en blanco, por '\n\n'), para no estirar los finales de párrafo.
    const justify = i < lines.length - 1 && lines[i].trim() !== '' && (lines[i + 1] || '').trim() !== ''
    if (justify) drawJustifiedLine(doc, lines[i], MARGIN_LEFT, y, CONTENT_WIDTH)
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

export async function POST(request: NextRequest) {
  try {
    const authSupabase = createServerSupabaseClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: authProfile } = await authSupabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!authProfile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { reportData, patientName, documents, clinicLogoUrl, reportDate, sessionId } = await request.json() as {
      reportData: any
      patientName: string
      documents?: { file_name: string; storage_path: string }[]
      clinicLogoUrl?: string | null
      reportDate?: string | null
      sessionId?: string | null
    }

    // Verificar propiedad de los adjuntos (evitar fuga entre clínicas)
    const paths = (documents || []).map((d) => d.storage_path).filter(Boolean)
    if (paths.length > 0) {
      const { data: owned } = await authSupabase.from('documents').select('storage_path, clinic_id').in('storage_path', paths)
      const ok = new Set((owned || []).filter((d) => d.clinic_id === authProfile.clinic_id).map((d) => d.storage_path))
      if (paths.some((p) => !ok.has(p))) return NextResponse.json({ error: 'Recursos no autorizados' }, { status: 403 })
    }

    // Anexo de datos objetivos (opcional): si el fisio activó "incluir en PDF", se leen FRESCOS
    // los valores de session_tests.result_data de la sesión (solo pruebas con métricas definidas).
    let metricsAnnex: { test_name: string; metrics: MetricDef[]; values: Record<string, any> }[] = []
    if (reportData?._meta?.include_metrics_in_pdf && sessionId) {
      const { data: sts } = await authSupabase
        .from('session_tests')
        .select('test_name, result_data, display_order, tests(result_schema)')
        .eq('session_id', sessionId)
        .eq('clinic_id', authProfile.clinic_id)
        .order('display_order', { ascending: true })
      metricsAnnex = (sts || [])
        .map((st: any) => ({ test_name: st.test_name, metrics: parseMetricsSchema(st.tests?.result_schema), values: st.result_data || {} }))
        .filter((t) => t.metrics.length > 0)
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
    // (Semáforo y resumen ejecutivo retirados del informe; la síntesis final vive en "conclusiones".)

    // ===== Documento narrativo (una sola pieza). Las gráficas de VALD van como ANEXO al final. =====
    const doc = new jsPDF('portrait', 'mm', 'a4')
    let y = 45
    if (_logoDataUrl && _logoExt) {
      const { w, h, x } = fitLogo(doc, _logoDataUrl, 50, 25)
      doc.addImage(_logoDataUrl, _logoExt, x, 15, w, h); y = 48
    }
    doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.8); doc.line(MARGIN_LEFT, y + 2, PAGE_WIDTH - MARGIN_RIGHT, y + 2)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(30, 30, 30)
    doc.text('INFORME DE RENDIMIENTO Y PREVENCIÓN', PAGE_WIDTH / 2, y + 16, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120, 120, 120)
    doc.text('Metodología Podium®', PAGE_WIDTH / 2, y + 23, { align: 'center' })

    // Tarjeta de datos del informe en la portada (deportista, deporte, equipo, estudio, fecha).
    y = y + 33
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const fmtFecha = (iso?: string | null) => {
      const d = iso ? new Date(iso) : new Date()
      const dd = isNaN(d.getTime()) ? new Date() : d
      return `${dd.getDate()} de ${MESES[dd.getMonth()]} de ${dd.getFullYear()}`
    }
    const coverRows: [string, string][] = [
      ['Deportista', String(perfil.nombre || patientName || '—')],
      ['Equipo', String(perfil.equipo || '—')],
      ...(perfil.estudio ? ([['Estudio', String(perfil.estudio)]] as [string, string][]) : []),
      ['Fecha del informe', fmtFecha(reportDate)],
    ]
    const cardRowH = 7.5, cardPad = 6
    const cardH = cardPad * 2 + coverRows.length * cardRowH
    doc.setDrawColor(228, 228, 228); doc.setLineWidth(0.3); doc.setFillColor(250, 250, 250)
    doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, cardH, 2, 2, 'FD')
    let ry = y + cardPad + 4
    for (const [label, value] of coverRows) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(90, 90, 90)
      doc.text(label, MARGIN_LEFT + 6, ry)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30)
      doc.text(value, MARGIN_LEFT + 58, ry)
      ry += cardRowH
    }
    y = y + cardH + 12

    y = para(doc, rd.objetivo_intro || '', y)
    addFooter(doc)

    // Sección 1 — Perfil del deportista
    doc.addPage(); addHeader(doc); y = MARGIN_TOP + 10
    y = sectionTitle(doc, '1. Perfil del deportista', y)
    const perfilRows: [string, any][] = [
      ['Nombre', perfil.nombre], ['Edad', perfil.edad != null ? `${perfil.edad} años` : null], ['Sexo', perfil.sexo],
      ['Deporte', perfil.deporte], ['Posición', perfil.posicion], ['Categoría', perfil.categoria], ['Equipo', perfil.equipo],
      ['Altura / Peso', (perfil.altura_cm || perfil.peso_kg) ? `${perfil.altura_cm ?? '—'} cm / ${perfil.peso_kg ?? '—'} kg` : null],
      ['Lateralidad', perfil.lateralidad], ['Horas de entrenamiento semanales', perfil.horas_entreno_semana != null ? String(perfil.horas_entreno_semana) : null],
    ]
    for (const [k, v] of perfilRows) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(70, 70, 70); doc.text(`${k}:`, MARGIN_LEFT, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40); doc.text(String(v || '—'), MARGIN_LEFT + 70, y)
      y += 6
    }
    addFooter(doc)

    // Sección 2 — Anamnesis deportiva (fluye tras el perfil; sin salto de página forzado)
    y += 8
    y = sectionTitle(doc, '2. Anamnesis deportiva', y)
    y = para(doc, rd.resumen_anamnesis || '', y)
    addFooter(doc)

    // Sección 3 — Valoración funcional (intro + interpretación 3.1–3.5, seguida)
    y += 8
    y = sectionTitle(doc, '3. Valoración funcional', y)
    y = para(doc, vf.introduccion || '', y, { fontStyle: 'italic' })
    y += 1
    const vfSub = (label: string, txt: string) => { y = subTitle(doc, label, y); y = para(doc, txt || '', y); y += 1 }
    vfSub('3.1 Calidad del movimiento', vf.calidad_movimiento)
    vfSub('3.2 Movilidad', vf.movilidad)
    vfSub('3.3 Fuerza', vf.fuerza)
    vfSub('3.4 Potencia', vf.potencia)
    vfSub('3.5 Capacidad reactiva', vf.capacidad_reactiva)
    y += 1
    para(doc, 'Las gráficas de la valoración funcional (VALD) se incluyen como anexo al final del informe.', y, { fontSize: 9, color: [120, 120, 120] })
    addFooter(doc)

    // Sección 4 — Hallazgos principales
    y += 8
    y = sectionTitle(doc, '4. Hallazgos principales', y)
    y = para(doc, rd.hallazgos || '', y)
    addFooter(doc)

    // Sección 5 — Conclusiones (incluye la síntesis final: fortalezas, riesgo y objetivo)
    y += 8
    y = sectionTitle(doc, '5. Conclusiones', y)
    y = para(doc, rd.conclusiones || '', y)
    addFooter(doc)

    // Sección 6 — Recomendaciones + descargo
    y += 8
    y = sectionTitle(doc, '6. Recomendaciones', y)
    const recSub = (label: string, txt: string) => { y = subTitle(doc, label, y); y = para(doc, txt || '', y); y += 1 }
    recSub('Capacidades prioritarias a desarrollar', rec.capacidades_prioritarias)
    recSub('Aspectos a monitorizar', rec.aspectos_monitorizar)
    recSub('Recomendaciones para el cuerpo técnico', rec.cuerpo_tecnico)
    recSub('Siguiente valoración funcional', rec.siguiente_valoracion)
    y += 4
    y = line(doc, y)
    y = para(doc, 'Descargo de responsabilidad:', y, { fontStyle: 'bolditalic', fontSize: 9, color: [100, 100, 100] })
    y = para(doc, rd.descargo || '', y, { fontStyle: 'italic', fontSize: 8, color: [120, 120, 120] })
    addFooter(doc)

    // Anexo de datos objetivos (solo si el fisio lo activó): tabla de métricas por prueba.
    if (metricsAnnex.length > 0) {
      doc.addPage(); addHeader(doc); y = MARGIN_TOP + 10
      y = sectionTitle(doc, 'Anexo · Datos objetivos (VALD)', y)
      const fmtVal = (m: MetricDef, v: any): string => {
        v = v || {}
        if (m.bilateral) {
          const base = `izq ${v.izq ?? '—'} / der ${v.der ?? '—'}`
          return m.percentil ? `${base} · pct izq ${v.pct_izq ?? '—'} / der ${v.pct_der ?? '—'}` : base
        }
        const base = `${v.valor ?? '—'}${m.percentil ? ` · pct ${v.percentil ?? '—'}` : ''}`
        return v.lado ? `${base} (${v.lado})` : base
      }
      for (const t of metricsAnnex) {
        y = subTitle(doc, t.test_name, y)
        for (const m of t.metrics) {
          y = para(doc, `${m.label}${m.unit ? ` (${m.unit})` : ''}: ${fmtVal(m, t.values[m.key])}`, y, { fontSize: 9 })
        }
        y += 2
      }
      addFooter(doc)
    }

    // Página de metodología (escalera PODIO 1–5), cierre del cuerpo del informe.
    doc.addPage(); addHeader(doc)
    const methImg = `data:image/jpeg;base64,${METODOLOGIA_JPEG_BASE64}`
    try {
      const mp = doc.getImageProperties(methImg)
      const ratio = mp.width / mp.height
      const maxW = CONTENT_WIDTH, maxH = 232
      let w = maxW, h = maxW / ratio
      if (h > maxH) { h = maxH; w = maxH * ratio }
      doc.addImage(methImg, 'JPEG', PAGE_WIDTH / 2 - w / 2, 34, w, h)
    } catch (e) {
      console.error('No se pudo incrustar la metodología:', e)
    }
    addFooter(doc)

    // Portada del ANEXO VALD (solo si hay PDFs adjuntos), justo antes de las gráficas.
    const valdPdfDocs = (documents || []).filter((d) => /\.pdf$/i.test(d.file_name || ''))
    if (valdPdfDocs.length > 0) {
      doc.addPage(); addHeader(doc); y = MARGIN_TOP + 20
      y = sectionTitle(doc, 'Anexo · Informes VALD', y)
      para(doc, 'A continuación se adjuntan las gráficas y resultados objetivos de la valoración funcional (VALD), tal como los genera el sistema de medición.', y, { fontSize: 10, color: [90, 90, 90] })
      addFooter(doc)
    }

    const narrative = Buffer.from(doc.output('arraybuffer'))

    // ===== FUSIÓN: cuerpo narrativo + páginas de VALD como anexo final =====
    const out = await PDFDocument.create()
    const pdfNarr = await PDFDocument.load(narrative)
    ;(await out.copyPages(pdfNarr, pdfNarr.getPageIndices())).forEach((p) => out.addPage(p))

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (serviceRoleKey && supabaseUrl && valdPdfDocs.length > 0) {
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      for (const d of valdPdfDocs) {
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
