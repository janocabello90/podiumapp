import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { drawJustifiedLine } from '@/lib/reports/pdfJustify'

const MARGIN_LEFT = 25
const MARGIN_RIGHT = 25
const MARGIN_TOP = 30
const MARGIN_BOTTOM = 30
const PAGE_WIDTH = 210 // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const FOOTER_TEXT = 'www.clinicapodium.com  -  608392019  -  C/ Almagro 16 50004 Zaragoza'

function addFooter(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(FOOTER_TEXT, PAGE_WIDTH / 2, pageHeight - 12, { align: 'center' })
}

function addHeaderLine(doc: jsPDF) {
  doc.setDrawColor(218, 165, 32)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, 24, PAGE_WIDTH - MARGIN_RIGHT, 24)
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y > doc.internal.pageSize.getHeight() - MARGIN_BOTTOM - needed) {
    addFooter(doc)
    doc.addPage()
    addHeaderLine(doc)
    return MARGIN_TOP + 10
  }
  return y
}

function writeParagraph(doc: jsPDF, text: string, y: number, opts?: { fontSize?: number; fontStyle?: string; color?: number[] }): number {
  const fontSize = opts?.fontSize || 10
  const fontStyle = opts?.fontStyle || 'normal'
  const color = opts?.color || [60, 60, 60]
  doc.setFont('helvetica', fontStyle)
  doc.setFontSize(fontSize)
  doc.setTextColor(color[0], color[1], color[2])
  const applyStyle = () => { doc.setFont('helvetica', fontStyle); doc.setFontSize(fontSize); doc.setTextColor(color[0], color[1], color[2]) }
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  const lineHeight = fontSize * 0.45
  for (let i = 0; i < lines.length; i++) {
    const prevY = y
    y = ensureSpace(doc, y, 10)
    if (y !== prevY) applyStyle() // hubo salto de página: addFooter dejó la letra en 8pt gris
    // Justificar solo líneas "llenas": ni la última del texto ni la última de un párrafo
    // (la siguiente en blanco, por '\n\n'), para no estirar los finales de párrafo.
    const justify = i < lines.length - 1 && lines[i].trim() !== '' && (lines[i + 1] || '').trim() !== ''
    if (justify) drawJustifiedLine(doc, lines[i], MARGIN_LEFT, y, CONTENT_WIDTH)
    else doc.text(lines[i], MARGIN_LEFT, y)
    y += lineHeight
  }
  return y + 3
}

function writeSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 30, 30)
  doc.text(title, MARGIN_LEFT, y)
  y += 3
  doc.setDrawColor(218, 165, 32)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
  return y + 8
}

function writeSubtitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(45, 45, 45)
  doc.text(title, MARGIN_LEFT, y)
  return y + 6
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { reportId } = await request.json()
    if (!reportId) return NextResponse.json({ error: 'reportId requerido' }, { status: 400 })

    const { data: report } = await supabase
      .from('reports')
      .select('id, clinic_id, scope, report_data')
      .eq('id', reportId)
      .eq('clinic_id', profile.clinic_id)
      .single()

    if (!report || report.scope !== 'campaign') {
      return NextResponse.json({ error: 'Informe de estudio no encontrado' }, { status: 404 })
    }

    const rd = (report.report_data || {}) as any
    const meta = rd._meta || {}

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const p = rd.portada || {}
    const equipo = p.equipo || meta.equipo || 'Equipo'
    const estudio = p.estudio || meta.estudio || ''
    const grupo = p.grupo || meta.grupo || ''
    const ronda = p.ronda ?? meta.ronda
    const cobertura = p.cobertura || (meta.cobertura_valorados != null && meta.roster_total != null ? `${meta.cobertura_valorados}/${meta.roster_total}` : '')

    // Portada
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(20, 40, 80)
    doc.text('Informe de Equipo', PAGE_WIDTH / 2, 58, { align: 'center' })
    doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.8); doc.line(PAGE_WIDTH / 2 - 30, 64, PAGE_WIDTH / 2 + 30, 64)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 30, 30)
    doc.text(String(equipo), PAGE_WIDTH / 2, 78, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90)
    const bits = [estudio, grupo, ronda != null ? `Ronda ${ronda}` : ''].filter(Boolean)
    if (bits.length) doc.text(bits.join('  ·  '), PAGE_WIDTH / 2, 86, { align: 'center' })
    if (cobertura) doc.text(`Cobertura: ${cobertura} jugadores`, PAGE_WIDTH / 2, 93, { align: 'center' })
    doc.text('Método Podium™ — informe asistido por IA y revisado por fisioterapeuta colegiado', PAGE_WIDTH / 2, 107, { align: 'center', maxWidth: CONTENT_WIDTH })

    addFooter(doc)
    doc.addPage()
    addHeaderLine(doc)
    let y = MARGIN_TOP + 10

    if (rd.resumen_equipo) {
      y = writeSectionTitle(doc, 'Resumen del equipo', y)
      y = writeParagraph(doc, String(rd.resumen_equipo), y)
    }

    // Panel de métricas (calculado)
    if (Array.isArray(rd.panel_metricas) && rd.panel_metricas.length) {
      y = writeSectionTitle(doc, 'Panel de métricas del equipo', y)
      const byTest: Record<string, any[]> = {}
      for (const s of rd.panel_metricas) (byTest[s.test_name] ||= []).push(s)
      for (const [testName, stats] of Object.entries(byTest)) {
        y = writeSubtitle(doc, testName, y)
        for (const s of stats as any[]) {
          const stat = s.bilateral
            ? `izq ${s.mean_izq ?? '—'} / der ${s.mean_der ?? '—'}`
            : `media ${s.mean ?? '—'}${s.min != null ? ` (rango ${s.min}–${s.max})` : ''}`
          const vig = Array.isArray(s.outliers) && s.outliers.length
            ? `  ·  a vigilar: ${s.outliers.map((o: any) => `${o.nombre} (${o.detalle})`).join(', ')}`
            : ''
          y = writeParagraph(doc, `${s.label}${s.unit ? ` (${s.unit})` : ''}: ${stat}  ·  n=${s.n}${vig}`, y, { fontSize: 9 })
        }
        y += 1
      }
    }

    if (rd.patrones_y_riesgos) { y = writeSectionTitle(doc, 'Patrones y riesgos', y); y = writeParagraph(doc, String(rd.patrones_y_riesgos), y) }
    if (rd.fortalezas) { y = writeSectionTitle(doc, 'Fortalezas del colectivo', y); y = writeParagraph(doc, String(rd.fortalezas), y) }

    if (Array.isArray(rd.jugadores_a_vigilar) && rd.jugadores_a_vigilar.length) {
      y = writeSectionTitle(doc, 'Jugadores a vigilar', y)
      for (const j of rd.jugadores_a_vigilar) {
        const nombre = j?.nombre ? String(j.nombre) : ''
        const motivo = j?.motivo ? `: ${String(j.motivo)}` : ''
        y = writeParagraph(doc, `•  ${nombre}${motivo}`, y)
      }
    }

    if (rd.recomendaciones) { y = writeSectionTitle(doc, 'Recomendaciones', y); y = writeParagraph(doc, String(rd.recomendaciones), y) }
    if (rd.descargo) { y = writeSectionTitle(doc, 'Descargo de responsabilidad', y); y = writeParagraph(doc, String(rd.descargo), y, { fontSize: 8, color: [120, 120, 120] }) }

    addFooter(doc)

    const pdfBytes = Buffer.from(doc.output('arraybuffer'))
    const safeName = String(equipo).replace(/\s+/g, '_')
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Informe_Equipo_${safeName}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Campaign PDF export error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
