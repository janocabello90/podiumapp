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

// Ajusta el logo dentro de una caja maxW×maxH respetando su proporción, centrado.
function fitLogo(doc: jsPDF, dataUrl: string, maxW: number, maxH: number): { w: number; h: number; x: number } {
  try {
    const props = doc.getImageProperties(dataUrl)
    const ratio = (props.width || 1) / (props.height || 1)
    let w = maxW, h = w / ratio
    if (h > maxH) { h = maxH; w = h * ratio }
    return { w, h, x: (PAGE_WIDTH - w) / 2 }
  } catch { return { w: maxW, h: maxH, x: (PAGE_WIDTH - maxW) / 2 } }
}

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

const RISK_RGB: Record<string, number[]> = { rojo: [201, 63, 63], ambar: [201, 145, 32], verde: [52, 150, 82] }

// Barras horizontales (gráfico) dibujadas con rects.
function drawHBars(doc: jsPDF, rows: { label: string; value: number; color: number[] }[], y: number, unit = ''): number {
  if (!rows.length) return y
  const labelW = 46, barX = MARGIN_LEFT + labelW, barMaxW = CONTENT_WIDTH - labelW - 16
  const max = Math.max(...rows.map((r) => r.value), 1)
  const rowH = 5.4
  for (const r of rows) {
    y = ensureSpace(doc, y, rowH + 2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(70, 70, 70)
    doc.text(String(doc.splitTextToSize(r.label, labelW - 3)[0] || ''), MARGIN_LEFT, y + 3.1)
    doc.setFillColor(238, 240, 244); doc.roundedRect(barX, y, barMaxW, rowH - 1.5, 0.8, 0.8, 'F')
    const bw = Math.max((r.value / max) * barMaxW, 0.6)
    doc.setFillColor(r.color[0], r.color[1], r.color[2]); doc.roundedRect(barX, y, bw, rowH - 1.5, 0.8, 0.8, 'F')
    doc.setFontSize(7); doc.setTextColor(60, 60, 60)
    doc.text(`${Math.round(r.value)}${unit}`, barX + bw + 1.5, y + 3.1)
    y += rowH + 1.2
  }
  return y + 2
}

// Barra apilada del reparto de riesgo + leyenda.
function drawStackedRisk(doc: jsPDF, segs: { n: number; color: number[]; label: string }[], y: number): number {
  const total = segs.reduce((a, s) => a + s.n, 0)
  if (!total) return y
  y = ensureSpace(doc, y, 16)
  const barW = CONTENT_WIDTH, h = 7
  let x = MARGIN_LEFT
  for (const s of segs) {
    if (s.n === 0) continue
    const sw = (s.n / total) * barW
    doc.setFillColor(s.color[0], s.color[1], s.color[2]); doc.rect(x, y, sw, h, 'F')
    if (sw > 8) { doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(String(s.n), x + sw / 2, y + h / 2 + 1.4, { align: 'center' }) }
    x += sw
  }
  y += h + 4
  let lx = MARGIN_LEFT
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  for (const s of segs) {
    doc.setFillColor(s.color[0], s.color[1], s.color[2]); doc.rect(lx, y - 2.4, 2.4, 2.4, 'F')
    doc.setTextColor(70, 70, 70); doc.text(`${s.label}: ${s.n}`, lx + 3.4, y)
    lx += doc.getTextWidth(`${s.label}: ${s.n}`) + 12
  }
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

    // ── Portada (logo + título), al estilo del informe individual ──
    let coverY = 40
    let logoData: string | null = null
    try {
      const { data: clinic } = await supabase.from('clinics').select('logo_url').eq('id', profile.clinic_id).single()
      if (clinic?.logo_url) {
        const resp = await fetch(clinic.logo_url, { signal: AbortSignal.timeout(5000) })
        if (resp.ok) {
          const ct = resp.headers.get('content-type') || 'image/png'
          const ext = ct.includes('png') || ct.includes('svg') ? 'PNG' : 'JPEG'
          logoData = `data:${ct};base64,${Buffer.from(await resp.arrayBuffer()).toString('base64')}`
          const fit = fitLogo(doc, logoData, 50, 24)
          doc.addImage(logoData, ext, fit.x, 16, fit.w, fit.h)
          coverY = 16 + fit.h + 6
        }
      }
    } catch (e) { console.error('Logo load error (campaign PDF):', e) }
    if (!logoData) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 40, 80)
      doc.text('MÉTODO PODIUM', PAGE_WIDTH / 2, 26, { align: 'center' }); coverY = 34
    }
    // Línea dorada + título
    doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.8); doc.line(MARGIN_LEFT, coverY, PAGE_WIDTH - MARGIN_RIGHT, coverY)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20, 40, 80)
    doc.text('INFORME DE RENDIMIENTO Y PREVENCIÓN — EQUIPO', PAGE_WIDTH / 2, coverY + 11, { align: 'center', maxWidth: CONTENT_WIDTH })
    // Datos del equipo (alineados a la izquierda, como los datos del paciente)
    let y = coverY + 24
    const field = (label: string, value: string) => {
      y = ensureSpace(doc, y, 8)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(50, 50, 50); doc.text(label, MARGIN_LEFT, y)
      doc.setFont('helvetica', 'normal'); doc.text(value, MARGIN_LEFT + doc.getTextWidth(label) + 1.5, y); y += 6
    }
    field('Equipo:', ` ${equipo}`)
    if (estudio) field('Estudio:', ` ${estudio}${grupo ? ` · ${grupo}` : ''}`)
    if (ronda != null) field('Ronda:', ` ${ronda}`)
    if (cobertura) field('Cobertura:', ` ${cobertura} jugadores valorados`)
    y += 2; doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.3); doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y); y += 9

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

    // Gráficos (calculado)
    if (vis.graficos) {
      const sem: any[] = Array.isArray(rd.semaforo) ? rd.semaforo : []
      const rj = sem.filter((r) => r?.nivel === 'rojo').length
      const am = sem.filter((r) => r?.nivel === 'ambar').length
      const vd = sem.filter((r) => r?.nivel === 'verde').length
      const asimJug = sem.filter((r) => r?.maxAsim != null).sort((a, b) => b.maxAsim - a.maxAsim)
        .map((r) => ({ label: r.nombre, value: r.maxAsim, color: RISK_RGB[r.nivel] || [120, 120, 120] }))
      const asimPrueba = (Array.isArray(rd.panel_metricas) ? rd.panel_metricas : [])
        .filter((s: any) => /asim/i.test(s.key) && !s.bilateral && s.mean != null)
        .map((s: any) => ({ label: s.test_name, value: s.mean, color: [37, 99, 235] }))
        .sort((a: any, b: any) => b.value - a.value)
      const zonas = ((rd.lesiones?.zonas as any[]) || []).slice(0, 8).map((z) => ({ label: z.zona, value: z.n, color: [8, 145, 178] }))
      if (rj + am + vd > 0 || asimJug.length || asimPrueba.length || zonas.length) {
        y = writeSectionTitle(doc, 'Gráficos', y)
        if (rj + am + vd > 0) {
          y = writeSubtitle(doc, 'Reparto de riesgo del equipo', y)
          y = drawStackedRisk(doc, [
            { n: rj, color: [176, 42, 42], label: 'Riesgo alto' },
            { n: am, color: [162, 110, 20], label: 'Riesgo medio' },
            { n: vd, color: [40, 120, 66], label: 'Sin señales' },
          ], y)
        }
        if (asimJug.length) { y = writeSubtitle(doc, 'Asimetría máxima por jugador (%)', y); y = drawHBars(doc, asimJug, y, '%') }
        if (asimPrueba.length) { y = writeSubtitle(doc, 'Asimetría media por prueba (%)', y); y = drawHBars(doc, asimPrueba, y, '%') }
        if (zonas.length) { y = writeSubtitle(doc, 'Lesiones por zona (24 m)', y); y = drawHBars(doc, zonas, y) }
      }
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
        y = ensureSpace(doc, y, 12)
        const dot = RISK_RGB[r?.nivel] || [150, 150, 150]
        doc.setFillColor(dot[0], dot[1], dot[2]); doc.circle(MARGIN_LEFT + 1, y - 1, 1.2, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(20, 40, 80)
        doc.text(String(r?.nombre || ''), MARGIN_LEFT + 5, y)
        if (r?.metricaClave) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120)
          doc.text(String(r.metricaClave), PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' })
        }
        y += 4.5
        if (r?.titular) {
          let t = String(r.titular).trim()
          if (!/[.!?…]$/.test(t)) t += '…'
          y = writeParagraph(doc, t, y, { fontSize: 8.5, color: [95, 95, 95] })
        } else { y += 1 }
        y += 1.5
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
