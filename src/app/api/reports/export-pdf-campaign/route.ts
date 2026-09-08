import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { drawJustifiedLine } from '@/lib/reports/pdfJustify'
import { resolveVisibleSections } from '@/lib/reports/teamReportView'

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

const NAVY: [number, number, number] = [20, 40, 80]
const GOLD: [number, number, number] = [218, 165, 32]

function writeSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 30)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]); doc.rect(MARGIN_LEFT, y - 3.6, 1.6, 4.6, 'F') // acento
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text(title, MARGIN_LEFT + 4, y)
  y += 3
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2])
  doc.setLineWidth(0.3)
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
  return y + 8
}

// Semáforo como fichas de color (pills) agrupadas por nivel de riesgo.
function drawSemaphore(doc: jsPDF, groups: { label: string; bg: number[]; fg: number[]; items: string[] }[], y: number): number {
  const pageH = doc.internal.pageSize.getHeight()
  for (const g of groups) {
    if (!g.items.length) continue
    y = ensureSpace(doc, y, 14)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(g.fg[0], g.fg[1], g.fg[2])
    doc.text(`${g.label.toUpperCase()}  ·  ${g.items.length}`, MARGIN_LEFT, y)
    y += 5
    let x = MARGIN_LEFT
    const h = 6, padX = 2.4, gap = 2.2
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    for (const it of g.items) {
      const w = doc.getTextWidth(it) + padX * 2
      if (x + w > PAGE_WIDTH - MARGIN_RIGHT) { x = MARGIN_LEFT; y += h + gap }
      if (y > pageH - MARGIN_BOTTOM - h) { addFooter(doc); doc.addPage(); addHeaderLine(doc); y = MARGIN_TOP + 10; x = MARGIN_LEFT }
      doc.setFillColor(g.bg[0], g.bg[1], g.bg[2]); doc.roundedRect(x, y - 4, w, h, 1.6, 1.6, 'F')
      doc.setTextColor(g.fg[0], g.fg[1], g.fg[2]); doc.text(it, x + padX, y)
      x += w + gap
    }
    y += h + 4
  }
  return y
}

// Panel de métricas como TABLA (Prueba · métrica | Media | Rango | n).
function drawPanelTable(doc: jsPDF, rows: { c1: string; c2: string; c3: string; c4: string }[], y: number): number {
  const x1 = MARGIN_LEFT + 1, x2 = MARGIN_LEFT + 96, x3 = MARGIN_LEFT + 134, x4 = PAGE_WIDTH - MARGIN_RIGHT - 6
  const header = () => {
    doc.setFillColor(240, 242, 246); doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(110, 110, 110)
    doc.text('Prueba · métrica', x1, y); doc.text('Media', x2, y); doc.text('Rango', x3, y); doc.text('n', x4, y)
    y += 5
  }
  y = ensureSpace(doc, y, 16); header()
  for (const r of rows) {
    const prevY = y
    y = ensureSpace(doc, y, 8)
    if (y !== prevY) header()
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(55, 55, 55)
    doc.text(String(doc.splitTextToSize(r.c1, 92)[0] || ''), x1, y)
    doc.setTextColor(30, 30, 30); doc.text(r.c2, x2, y); doc.text(r.c3, x3, y); doc.text(r.c4, x4, y)
    y += 2
    doc.setDrawColor(232, 232, 232); doc.setLineWidth(0.2); doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
    y += 3
  }
  return y + 3
}

function writeSubtitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(45, 45, 45)
  doc.text(title, MARGIN_LEFT, y)
  return y + 6
}

// Fila de tarjetas de KPI (número grande + etiqueta), estilo cuadro de mando.
function drawKpiCards(doc: jsPDF, cards: { n: string; t: string }[], y: number): number {
  const gap = 4
  const w = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length
  const h = 20
  y = ensureSpace(doc, y, h + 6)
  cards.forEach((c, i) => {
    const x = MARGIN_LEFT + i * (w + gap)
    doc.setFillColor(244, 246, 249); doc.roundedRect(x, y, w, h, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20, 40, 80)
    doc.text(String(c.n), x + w / 2, y + 9.5, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 110, 110)
    doc.text(c.t, x + w / 2, y + 15, { align: 'center', maxWidth: w - 4 })
  })
  return y + h + 7
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

    // Portada — banda de marca
    doc.setFillColor(20, 40, 80); doc.rect(0, 0, PAGE_WIDTH, 64, 'F')
    doc.setFillColor(218, 165, 32); doc.rect(0, 64, PAGE_WIDTH, 1.6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(218, 165, 32)
    doc.text('MÉTODO PODIUM', PAGE_WIDTH / 2, 27, { align: 'center' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(255, 255, 255)
    doc.text('Informe de Rendimiento', PAGE_WIDTH / 2, 42, { align: 'center' })
    doc.text('y Prevención de Equipo', PAGE_WIDTH / 2, 52, { align: 'center' })
    // Datos del equipo
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20, 40, 80)
    doc.text(String(equipo), PAGE_WIDTH / 2, 88, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90)
    const bits = [estudio, grupo, ronda != null ? `Ronda ${ronda}` : ''].filter(Boolean)
    if (bits.length) doc.text(bits.join('    ·    '), PAGE_WIDTH / 2, 97, { align: 'center' })
    if (cobertura) doc.text(`Cobertura: ${cobertura} jugadores valorados`, PAGE_WIDTH / 2, 104, { align: 'center' })
    doc.setFontSize(9); doc.setTextColor(140, 140, 140)
    doc.text('Informe asistido por IA y revisado por fisioterapeuta colegiado', PAGE_WIDTH / 2, 122, { align: 'center', maxWidth: CONTENT_WIDTH })

    addFooter(doc)
    doc.addPage()
    addHeaderLine(doc)
    let y = MARGIN_TOP + 10

    // Solo se exportan las secciones que el fisio dejó visibles en la vista (preset/toggles).
    const vis = resolveVisibleSections(rd._view)

    // KPIs (calculado) — tarjetas
    if (vis.kpis && rd.kpis) {
      const k = rd.kpis
      y = writeSectionTitle(doc, 'Indicadores del equipo', y)
      y = drawKpiCards(doc, [
        { n: String(k.valorados ?? '—'), t: 'valorados' },
        { n: k.pctAsimetriaAlta != null ? `${k.pctAsimetriaAlta}%` : '—', t: 'con asimetría >15%' },
        { n: String(k.conLesion24m ?? 0), t: 'con lesión (24 m)' },
        { n: String(k.aVigilar ?? 0), t: 'a vigilar' },
      ], y)
    }

    // Semáforo (calculado) — con punto de color por nivel de riesgo
    if (vis.semaforo && Array.isArray(rd.semaforo) && rd.semaforo.length) {
      y = writeSectionTitle(doc, 'Semáforo de jugadores', y)
      const byLvl: Record<string, string[]> = { rojo: [], ambar: [], verde: [] }
      for (const r of rd.semaforo) {
        const asim = r?.maxAsim != null ? ` (${Math.round(r.maxAsim)}%)` : ''
        if (byLvl[r?.nivel]) byLvl[r.nivel].push(`${r.nombre}${asim}`)
      }
      y = drawSemaphore(doc, [
        { label: 'Riesgo alto', bg: [250, 232, 232], fg: [176, 42, 42], items: byLvl.rojo },
        { label: 'Riesgo medio', bg: [252, 244, 227], fg: [162, 110, 20], items: byLvl.ambar },
        { label: 'Sin señales de riesgo', bg: [232, 245, 236], fg: [40, 120, 66], items: byLvl.verde },
      ], y)
    }

    if (vis.resumen_equipo && rd.resumen_equipo) {
      y = writeSectionTitle(doc, 'Resumen del equipo', y)
      y = writeParagraph(doc, String(rd.resumen_equipo), y)
    }

    // Panel de métricas (calculado) — como tabla
    if (vis.panel_metricas && Array.isArray(rd.panel_metricas) && rd.panel_metricas.length) {
      const isEmpty = (s: any) => s.bilateral ? ((s.mean_izq ?? 0) === 0 && (s.mean_der ?? 0) === 0) : ((s.mean ?? 0) === 0 && (s.max ?? 0) === 0)
      const rows = (rd.panel_metricas as any[]).filter((s) => !isEmpty(s)).map((s) => ({
        c1: `${s.test_name} · ${s.label}${s.unit ? ` (${s.unit})` : ''}`,
        c2: s.bilateral ? `izq ${s.mean_izq ?? '—'} / der ${s.mean_der ?? '—'}` : `${s.mean ?? '—'}`,
        c3: !s.bilateral && s.min != null ? `${s.min}–${s.max}` : '—',
        c4: String(s.n ?? ''),
      }))
      if (rows.length) {
        y = writeSectionTitle(doc, 'Panel de métricas del equipo', y)
        y = drawPanelTable(doc, rows, y)
      }
    }

    // Radiografía de lesiones (calculado)
    if (vis.lesiones && rd.lesiones && (rd.lesiones.totalLesiones || 0) > 0) {
      const l = rd.lesiones
      y = writeSectionTitle(doc, 'Radiografía de lesiones (24 meses)', y)
      const zonas = Array.isArray(l.zonas) ? l.zonas.slice(0, 6).map((z: any) => `${z.zona} ${z.n}`).join(', ') : ''
      y = writeParagraph(doc, `${l.jugadoresConLesion} jugadores  ·  ${l.totalLesiones} lesiones  ·  ${l.conCirugia} con cirugía.${zonas ? `  Zonas: ${zonas}.` : ''}`, y)
    }

    if (vis.patrones_y_riesgos && rd.patrones_y_riesgos) { y = writeSectionTitle(doc, 'Patrones y riesgos', y); y = writeParagraph(doc, String(rd.patrones_y_riesgos), y) }
    if (vis.fortalezas && rd.fortalezas) { y = writeSectionTitle(doc, 'Fortalezas del colectivo', y); y = writeParagraph(doc, String(rd.fortalezas), y) }

    // Grupos de trabajo (IA)
    if (vis.grupos_de_trabajo && Array.isArray(rd.grupos_de_trabajo) && rd.grupos_de_trabajo.length) {
      y = writeSectionTitle(doc, 'Grupos de trabajo', y)
      for (const g of rd.grupos_de_trabajo) {
        const nombre = g?.nombre ? String(g.nombre) : 'Grupo'
        const foco = g?.foco ? ` — ${String(g.foco)}` : ''
        y = writeParagraph(doc, `•  ${nombre}${foco}`, y, { fontStyle: 'bold', fontSize: 9 })
        if (Array.isArray(g?.jugadores) && g.jugadores.length) y = writeParagraph(doc, `   ${g.jugadores.join(', ')}`, y, { fontSize: 9 })
      }
    }

    if (vis.jugadores_a_vigilar && Array.isArray(rd.jugadores_a_vigilar) && rd.jugadores_a_vigilar.length) {
      y = writeSectionTitle(doc, 'Jugadores a vigilar', y)
      for (const j of rd.jugadores_a_vigilar) {
        const nombre = j?.nombre ? String(j.nombre) : ''
        const motivo = j?.motivo ? `: ${String(j.motivo)}` : ''
        y = writeParagraph(doc, `•  ${nombre}${motivo}`, y)
      }
    }

    if (vis.recomendaciones && rd.recomendaciones) { y = writeSectionTitle(doc, 'Recomendaciones', y); y = writeParagraph(doc, String(rd.recomendaciones), y) }

    // Anexo por jugador (calculado)
    if (vis.anexo && Array.isArray(rd.anexo) && rd.anexo.length) {
      y = writeSectionTitle(doc, 'Anexo por jugador', y)
      for (const r of rd.anexo) {
        const met = r?.metricaClave ? `  ·  ${String(r.metricaClave)}` : ''
        const tit = r?.titular ? `: ${String(r.titular)}` : ''
        y = writeParagraph(doc, `•  ${String(r?.nombre || '')}${tit}${met}`, y, { fontSize: 9 })
      }
    }

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
