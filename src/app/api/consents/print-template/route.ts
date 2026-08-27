import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { drawJustifiedLine } from '@/lib/reports/pdfJustify'
import { getAnamnesisTemplateBlocks } from '@/lib/anamnesis/template'
import { IMAGE_CHANNELS } from '@/lib/clinical/consents'
import type { AnamnesisField } from '@/components/anamnesis/anamnesisFields'

// PDF "Anamnesis + consentimientos (EN BLANCO)" para imprimir y rellenar a mano.
// Se genera desde los mismos textos de consent_versions → nunca se descuadra con la app.

const ML = 20, MR = 20, MT = 22, MB = 18, PW = 210
const CW = PW - ML - MR
const FOOTER = 'www.clinicapodium.com  -  608392019  -  C/ Almagro 16 50004 Zaragoza'

// Profesional responsable fijo (según el documento oficial del club), hardcodeado para la
// variante "con el fisioterapeuta prerrellenado". NO se consulta la BD ni el usuario que imprime.
const FISIO_NOMBRE = 'Félix Lorente Sánchez'
const FISIO_COLEGIADO = '1884'

// Orden y etiqueta de los consentimientos en el documento.
const CONSENT_ORDER: { type: string; label: string; obligatorio: boolean }[] = [
  { type: 'info_treatment', label: 'Consentimiento informado (evaluación funcional)', obligatorio: true },
  { type: 'data_processing', label: 'Protección de datos', obligatorio: true },
  { type: 'ai_analysis', label: 'Uso de inteligencia artificial', obligatorio: true },
  { type: 'report_sharing_club', label: 'Compartir informe con el club', obligatorio: false },
  { type: 'image_rights', label: 'Derechos de imagen', obligatorio: false },
]

export async function GET(_req: NextRequest) {
  try {
    const prefillFisio = new URL(_req.url).searchParams.get('fisio') === '1'
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    const todayMadrid = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())

    const [{ data: clinic }, { data: versions }] = await Promise.all([
      supabase.from('clinics').select('name').eq('id', profile.clinic_id).single(),
      supabase.from('consent_versions').select('type, body').eq('clinic_id', profile.clinic_id).eq('is_active', true),
    ])
    const texts = new Map((versions || []).map((v: any) => [v.type, v.body as string]))
    const clinicName = clinic?.name || 'Clínica Podium'
    // Fuente única: la ficha/anamnesis del PDF sale de la MISMA plantilla de equipo que usa el digital.
    const teamBlocks = await getAnamnesisTemplateBlocks(supabase, profile.clinic_id, 'team')

    const doc = new jsPDF('portrait', 'mm', 'a4')
    let y = 0

    // Cabecerilla superior en todas las páginas (marca + descriptor).
    const runningHeader = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
      doc.text('PODIUM', ML, 12)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150)
      doc.text('Documentación del deportista · Valoración funcional', PW - MR, 12, { align: 'right' })
    }
    const addFooter = () => {
      const h = doc.internal.pageSize.getHeight()
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150)
      doc.text(FOOTER, PW / 2, h - 10, { align: 'center' })
    }
    const header = () => {
      runningHeader()
      doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.3); doc.line(ML, MT - 4, PW - MR, MT - 4)
      // Restaurar un estilo neutro tras el salto de página (addFooter deja fuente pequeña/gris).
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(55, 55, 55)
      y = MT
    }
    const ensure = (need: number) => {
      if (y > doc.internal.pageSize.getHeight() - MB - need) { addFooter(); doc.addPage(); header() }
    }
    const para = (text: string, o?: { size?: number; style?: string; color?: number[]; gap?: number }) => {
      const size = o?.size ?? 9.5, style = o?.style ?? 'normal', color = o?.color ?? [55, 55, 55]
      const apply = () => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(color[0], color[1], color[2]) }
      apply()
      const lines = doc.splitTextToSize(text || '', CW)
      const lh = size * 0.46
      for (const ln of lines) { ensure(lh + 2); if (y === MT) apply(); doc.text(ln, ML, y); y += lh }
      y += o?.gap ?? 2
    }
    const heading = (t: string) => {
      y += 7
      ensure(18)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 30, 30)
      doc.text(t, ML, y); y += 2
      doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.3); doc.line(ML, y, PW - MR, y); y += 6
    }
    // Etiqueta + línea en blanco para rellenar a mano.
    const fieldLine = (label: string, x: number, w: number) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90)
      doc.text(label, x, y)
      const lx = x + doc.getTextWidth(label) + 2
      // La línea nunca debe pasar del margen derecho, aunque w se pase de largo.
      const rx = Math.min(x + w, PW - MR)
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2); doc.line(lx, y + 0.5, rx, y + 0.5)
    }
    const checkboxAt = (x: number, yy: number) => {
      doc.setDrawColor(90, 90, 90); doc.setLineWidth(0.35); doc.rect(x, yy - 3, 3.6, 3.6)
    }
    // ===== Motor de texto enriquecido (justificado + negritas por palabra) para tablas y consentimientos =====
    const LABEL_W = 52
    const RPAD = 4 // margen derecho dentro de las celdas de tabla
    // Detecta un "lead-in" ("Etiqueta: resto") al inicio para poder ponerlo en negrita.
    const splitLeadIn = (text: string, maxLen = 66) => {
      const idx = text.indexOf(': ')
      if (idx > 1 && idx <= maxLen) return { lead: text.slice(0, idx + 1), rest: text.slice(idx + 2) }
      return { lead: '', rest: text }
    }
    type RW = { t: string; bold: boolean; w: number }
    const wordsFrom = (text: string, size: number): RW[] => {
      const mk = (s: string, bold: boolean): RW[] => s.split(/\s+/).filter(Boolean).map((t) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size)
        return { t, bold, w: doc.getTextWidth(t) }
      })
      const { lead, rest } = splitLeadIn(text)
      return lead ? [...mk(lead, true), ...mk(rest, false)] : mk(text, false)
    }
    // Reparte palabras en líneas para un ancho dado.
    const layoutRich = (words: RW[], maxWidth: number, size: number): RW[][] => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
      const sp = doc.getTextWidth(' ')
      const lines: RW[][] = []
      let cur: RW[] = [], curW = 0
      for (const w of words) {
        const add = cur.length ? sp + w.w : w.w
        if (curW + add > maxWidth && cur.length) { lines.push(cur); cur = [w]; curW = w.w }
        else { cur.push(w); curW += add }
      }
      if (cur.length) lines.push(cur)
      return lines
    }
    // Dibuja líneas ya maquetadas desde x; justifica todas menos la última.
    const drawRichLines = (lines: RW[][], x: number, maxWidth: number, size: number, color: number[], justify: boolean) => {
      const lh = size * 0.46
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
      const sp = doc.getTextWidth(' ')
      lines.forEach((ln, li) => {
        ensure(lh + 2)
        const wordsW = ln.reduce((s, w) => s + w.w, 0)
        const gaps = ln.length - 1
        let gap = sp
        if (justify && li < lines.length - 1 && gaps > 0) {
          const g = (maxWidth - wordsW) / gaps
          if (g > 0 && g < sp * 6) gap = g
        }
        let cx = x
        for (const w of ln) {
          doc.setFont('helvetica', w.bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color[0], color[1], color[2])
          doc.text(w.t, cx, y); cx += w.w + gap
        }
        y += lh
      })
    }
    // Fila de tabla "Etiqueta | valor" con etiqueta sombreada y valor justificado.
    const tableRow = (label: string, value: string) => {
      const size = 9, lh = size * 0.46
      const valX = ML + LABEL_W + 3
      const valW = ML + CW - RPAD - valX
      const valLines = layoutRich(wordsFrom(value || '', size), valW, size)
      const labLines = doc.splitTextToSize(label, LABEL_W - 5)
      const rowH = Math.max(valLines.length, labLines.length) * lh + 4
      ensure(rowH)
      const top = y
      doc.setFillColor(241, 236, 226); doc.rect(ML, top, LABEL_W, rowH, 'F')
      doc.setDrawColor(223, 216, 202); doc.setLineWidth(0.2)
      doc.rect(ML, top, CW, rowH); doc.line(ML + LABEL_W, top, ML + LABEL_W, top + rowH)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(85, 72, 50)
      labLines.forEach((l: string, i: number) => doc.text(l, ML + 2.5, top + 4 + i * lh))
      y = top + 4
      drawRichLines(valLines, valX, valW, size, [60, 60, 60], true)
      y = top + rowH
    }
    // Como tableRow pero el valor es una lista de viñetas (separadas por " • "), con lead-in en negrita.
    const tableRowBullets = (label: string, items: string[]) => {
      const size = 9, lh = size * 0.46
      const bulletX = ML + LABEL_W + 3
      const textX = bulletX + 4.5
      const valW = ML + CW - RPAD - textX
      const laid = items.map((it) => layoutRich(wordsFrom(it, size), valW, size))
      const labLines = doc.splitTextToSize(label, LABEL_W - 5)
      const gapBetween = 1.4
      const totalValH = laid.reduce((s, l) => s + l.length * lh, 0) + (items.length - 1) * gapBetween
      const rowH = Math.max(totalValH, labLines.length * lh) + 4
      ensure(rowH)
      const top = y
      doc.setFillColor(241, 236, 226); doc.rect(ML, top, LABEL_W, rowH, 'F')
      doc.setDrawColor(223, 216, 202); doc.setLineWidth(0.2)
      doc.rect(ML, top, CW, rowH); doc.line(ML + LABEL_W, top, ML + LABEL_W, top + rowH)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(85, 72, 50)
      labLines.forEach((l: string, i: number) => doc.text(l, ML + 2.5, top + 4 + i * lh))
      y = top + 4
      laid.forEach((lines, bi) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(60, 60, 60)
        doc.text('•', bulletX, y)
        drawRichLines(lines, textX, valW, size, [60, 60, 60], true)
        if (bi < laid.length - 1) y += gapBetween
      })
      y = top + rowH
    }
    // Texto de un consentimiento a ancho completo, justificado, con lead-ins de párrafo en negrita.
    const consentBody = (text: string) => {
      const size = 9
      for (const p of (text || '').split('\n')) {
        if (p.trim() === '') { y += size * 0.46 * 0.6; continue }
        drawRichLines(layoutRich(wordsFrom(p, size), CW, size), ML, CW, size, [70, 70, 70], true)
        y += 1.2
      }
    }
    const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
    const renderDataProcessing = (body: string) => {
      const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
      let seenRow = false
      const after: string[] = []
      for (const line of lines) {
        const idx = line.indexOf(':')
        const isRow = idx > 2 && idx < 46 && !line.slice(0, idx).includes('. ')
        if (isRow) {
          const lbl = line.slice(0, idx).trim(); const val = line.slice(idx + 1).trim()
          if (val.includes(' • ')) tableRowBullets(lbl, val.split(' • ').map((s) => cap(s.trim())).filter(Boolean))
          else tableRow(lbl, cap(val))
          seenRow = true
        }
        else if (!seenRow) { para(line, { size: 8.5, style: 'bold', color: [70, 70, 70], gap: 1 }) }
        else { after.push(line) }
      }
      y += 6
      if (after.length) consentBody(after.join(' '))
    }
    // Línea de decisión bajo cada consentimiento: obligatorio → "SÍ presto"; voluntario → Autorizo/No autorizo.
    const decisionLine = (obligatorio: boolean) => {
      ensure(8)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 40, 40)
      if (obligatorio) {
        checkboxAt(ML, y); doc.text('SÍ, presto mi consentimiento.', ML + 6, y)
      } else {
        checkboxAt(ML, y); doc.text('Autorizo', ML + 6, y)
        checkboxAt(ML + 42, y); doc.text('No autorizo', ML + 48, y)
      }
      y += 7
    }
    // Renderiza un consentimiento: título en negrita + cuerpo (tabla si es protección de datos) + decisión.
    const renderConsent = (c: { type: string; label: string; obligatorio: boolean }, body: string) => {
      ensure(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40)
      doc.text(c.label, ML, y); y += 6
      if (c.type === 'data_processing') renderDataProcessing(body)
      else consentBody(body)
      y += 2
      decisionLine(c.obligatorio)
      // Extras por tipo: destinatario del club (P17) y soportes de imagen (P18).
      if (c.type === 'report_sharing_club') {
        ensure(9); fieldLine('Club / entidad destinataria:', ML, CW); y += 9
      } else if (c.type === 'image_rights') {
        ensure(6)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90)
        doc.text('Soportes autorizados:', ML, y); y += 5
        doc.setFontSize(9); doc.setTextColor(40, 40, 40)
        let cx = ML
        for (const ch of IMAGE_CHANNELS) {
          const w = doc.getTextWidth(ch) + 12
          if (cx + w > PW - MR) { cx = ML; y += 6; ensure(6) }
          checkboxAt(cx, y); doc.text(ch, cx + 6, y)
          cx += w + 4
        }
        y += 6
        ensure(8); checkboxAt(ML, y); fieldLine('Otros:', ML + 6, 150); y += 7
      }
      y += 3
    }
    // Bloque de firma reutilizable (deportista mayor + representante legal si es menor).
    const signatureBlock = (title: string) => {
      ensure(40)
      para(title, { size: 9.5, style: 'bold', gap: 2 })
      para('Firma del deportista (mayor de edad):', { size: 9, gap: 2 })
      ensure(14); fieldLine('Firma:', ML, 90); fieldLine('Fecha:', ML + 100, CW); y += 12
      para('Si el deportista es menor de edad, firma el/la representante legal, que presta el consentimiento en su nombre:', { size: 8.5, color: [90, 90, 90], gap: 2 })
      ensure(22)
      fieldLine('Nombre:', ML, 90); fieldLine('DNI:', ML + 100, CW); y += 9
      fieldLine('Relación (padre/madre/tutor):', ML, 90); y += 9
      fieldLine('Firma:', ML, 90); fieldLine('Fecha:', ML + 100, CW); y += 10
    }
    // Recuadro sombreado de introducción ("Cómo funciona este documento").
    const introBox = (text: string) => {
      const size = 9, lh = size * 0.5
      doc.setFontSize(size)
      const lines = doc.splitTextToSize(text, CW - 10)
      const boxH = (lines.length + 1) * lh + 9
      ensure(boxH)
      doc.setFillColor(244, 241, 233); doc.rect(ML, y, CW, boxH, 'F')
      doc.setDrawColor(228, 220, 205); doc.setLineWidth(0.2); doc.rect(ML, y, CW, boxH)
      let ty = y + 6
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(70, 60, 40)
      doc.text('Cómo funciona este documento', ML + 5, ty); ty += lh + 1.5
      doc.setFont('helvetica', 'normal'); doc.setTextColor(70, 70, 70)
      for (const ln of lines) { doc.text(ln, ML + 5, ty); ty += lh }
      y += boxH + 3
    }

    // ===== Renderers genéricos de la anamnesis (bloques→PDF, fuente única con el digital) =====
    const blockHeadingPdf = (title: string, desc?: string) => {
      y += 3
      ensure(14)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(35, 35, 35)
      doc.text(title, ML, y); y += 1.5
      doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.2); doc.line(ML, y, PW - MR, y); y += 5
      if (desc) para(desc, { size: 8, color: [130, 130, 130], gap: 1 })
    }
    // Casillas ☐ opción, con salto de línea cuando no caben.
    const optionBoxesPdf = (options: string[]) => {
      ensure(6)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 40, 40)
      let cx = ML
      for (const opt of options) {
        const w = doc.getTextWidth(opt) + 11
        if (cx + w > PW - MR) { cx = ML; y += 6; ensure(6) }
        checkboxAt(cx, y); doc.text(opt, cx + 6, y)
        cx += w + 3
      }
      y += 7
    }
    const blankLinesPdf = (n: number) => {
      doc.setDrawColor(205, 205, 205); doc.setLineWidth(0.2)
      for (let i = 0; i < n; i++) { ensure(8); doc.line(ML, y + 4, PW - MR, y + 4); y += 8 }
      y += 1
    }
    const renderTablePdf = (f: AnamnesisField) => {
      const cols = f.columns || []
      const n = Math.max(cols.length, 1)
      const colW = CW / n
      const rows = f.rows || 4
      const headH = 6, rowH = 8
      const totalH = headH + rows * rowH
      ensure(totalH + 2)
      const top = y
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90)
      cols.forEach((c, i) => {
        const lns = doc.splitTextToSize(c.label, colW - 2)
        lns.slice(0, 2).forEach((l: string, li: number) => doc.text(l, ML + i * colW + 1.5, top + 3 + li * 3))
      })
      doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.2)
      for (let r = 0; r <= rows; r++) { const yy = top + headH + r * rowH; doc.line(ML, yy, PW - MR, yy) }
      for (let i = 0; i <= n; i++) { const x = ML + i * colW; doc.line(x, top + headH, x, top + headH + rows * rowH) }
      doc.line(ML, top, ML, top + headH); doc.line(PW - MR, top, PW - MR, top + headH); doc.line(ML, top, PW - MR, top)
      y = top + totalH + 2
    }
    // Un campo de la plantilla, rellenable a mano según su tipo.
    const renderFieldPdf = (f: AnamnesisField) => {
      para(f.label, { size: 9, color: [55, 55, 55], gap: f.description ? 0 : 1 })
      if (f.description) para(f.description, { size: 8, color: [130, 130, 130], gap: 1 })
      switch (f.type) {
        case 'select':
        case 'multiselect':
          if (f.options && f.options.length) optionBoxesPdf(f.options); else blankLinesPdf(1); break
        case 'boolean':
          optionBoxesPdf(['Sí', 'No']); break
        case 'scale':
          ensure(7); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90)
          doc.text('1   2   3   4   5   6   7   8   9   10      (rodea una)', ML, y); y += 7; break
        case 'textarea':
          blankLinesPdf(2); break
        case 'table':
          renderTablePdf(f); break
        default:
          blankLinesPdf(1); break
      }
      y += 1
    }

    // ===== Portada (página 1): marca + título + introducción =====
    runningHeader()
    doc.setFont('times', 'bold'); doc.setFontSize(24); doc.setTextColor(35, 35, 35)
    doc.text('PODIUM', PW / 2, 24, { align: 'center' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(180, 140, 45)
    // Centrado manual: jsPDF no cuenta el letter-spacing al centrar, y el subtítulo se iba a la derecha.
    const subtitle = 'FISIOTERAPIA DE PRECISIÓN · ZARAGOZA'
    const subCharSpace = 1.4
    const subW = doc.getTextWidth(subtitle) + subCharSpace * (subtitle.length - 1)
    doc.setCharSpace(subCharSpace)
    doc.text(subtitle, (PW - subW) / 2, 30)
    doc.setCharSpace(0)
    doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.5); doc.line(ML, 34, PW - MR, 34)
    doc.setFont('times', 'bold'); doc.setFontSize(17); doc.setTextColor(30, 30, 30)
    doc.text('DOCUMENTACIÓN DEL DEPORTISTA', PW / 2, 44, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(120, 120, 120)
    doc.text('Valoración funcional · Clínica Podium', PW / 2, 50, { align: 'center' })
    y = 58
    introBox('Recoge, de forma separada e independiente, tres decisiones distintas: (1) el consentimiento informado asistencial para realizar la valoración; (2) el tratamiento de datos de salud asociado; y (3) las autorizaciones voluntarias de comunicación de informes al club y de uso de imagen. Cada autorización voluntaria puede aceptarse o rechazarse por separado y no condiciona la realización de la valoración. Debe firmarse de forma individual por cada deportista; si es menor de edad, firma su representante legal.')

    // ===== 1. Información sobre protección de datos (capa informativa, como tabla) =====
    heading('1. Información sobre protección de datos')
    const dp = texts.get('data_processing')
    if (dp) {
      renderDataProcessing(dp)
      y += 1
      ensure(8)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 40, 40)
      checkboxAt(ML, y); doc.text('SÍ, consiento el tratamiento de mis datos de salud descrito.', ML + 6, y); y += 8
      // Identificación del centro y del profesional responsable (centro pre-rellenado; profesional a mano).
      para('Identificación del centro y del profesional responsable', { size: 9.5, style: 'bold', color: [40, 40, 40], gap: 2 })
      tableRow('Centro', 'FISIO ZARAGOZA, S.L.')
      tableRow('Fisioterapeuta responsable (nombre)', prefillFisio ? FISIO_NOMBRE : '')
      tableRow('Nº de colegiado/a', prefillFisio ? FISIO_COLEGIADO : '')
      tableRow('Autorización / registro sanitario del centro', '5024226')
      tableRow('Fecha de la valoración', prefillFisio ? todayMadrid : '')
    }

    // ===== 2. Consentimiento informado asistencial (+ IA) + firma del bloque =====
    heading('2. Consentimiento informado asistencial')
    para('Necesario para realizar la valoración. Lea cada apartado y marque la casilla.', { size: 8.5, color: [120, 120, 120] })
    for (const type of ['info_treatment', 'ai_analysis']) {
      const c = CONSENT_ORDER.find((o) => o.type === type)
      const body = texts.get(type)
      if (c && body) renderConsent(c, body)
    }
    signatureBlock('Firma del consentimiento asistencial y de datos')

    // ===== 3. Autorizaciones voluntarias e independientes + firma del bloque =====
    heading('3. Autorizaciones voluntarias e independientes')
    para('Opcionales. Puede aceptarlas o rechazarlas por separado; no condicionan la valoración.', { size: 8.5, color: [120, 120, 120] })
    for (const c of CONSENT_ORDER.filter((o) => !o.obligatorio)) {
      const body = texts.get(c.type)
      if (body) renderConsent(c, body)
    }
    signatureBlock('Firma de las autorizaciones voluntarias')

    // ===== 4. Ficha del deportista y anamnesis (desde la plantilla de EQUIPO — fuente única con el digital) =====
    heading('4. Ficha del deportista y anamnesis')
    para('El deportista (o su representante legal, si es menor) rellena sus datos y responde a las siguientes preguntas.', { size: 8.5, color: [120, 120, 120] })
    for (const block of teamBlocks) {
      blockHeadingPdf(block.title, block.description)
      for (const f of (block.fields || [])) renderFieldPdf(f)
    }
    // Firma de la ficha (la declaración de veracidad ya es un campo de la plantilla: bloque "Declaración").
    y += 2
    para('Firma del deportista (o representante legal, si es menor):', { size: 9, style: 'bold', gap: 3 })
    ensure(16)
    fieldLine('Nombre:', ML, 90); fieldLine('Fecha:', ML + 100, CW); y += 10
    fieldLine('Firma:', ML, 90); y += 8
    addFooter()

    const bytes = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Anamnesis_Consentimientos_en_blanco.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('print-template error:', error)
    return NextResponse.json({ error: error.message || 'Error al generar el PDF' }, { status: 500 })
  }
}
