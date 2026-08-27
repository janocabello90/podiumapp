import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { drawJustifiedLine } from '@/lib/reports/pdfJustify'

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
      y += 3
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
    // Fila de tabla "Etiqueta | valor" con la columna de etiqueta sombreada (estilo del documento del club).
    const LABEL_W = 52
    const tableRow = (label: string, value: string) => {
      doc.setFontSize(9)
      const lh = 9 * 0.46
      const valLines = doc.splitTextToSize(value || '', CW - LABEL_W - 5)
      const labLines = doc.splitTextToSize(label, LABEL_W - 5)
      const rowH = Math.max(valLines.length, labLines.length) * lh + 4
      ensure(rowH)
      const top = y
      doc.setFillColor(241, 236, 226); doc.rect(ML, top, LABEL_W, rowH, 'F')
      doc.setDrawColor(223, 216, 202); doc.setLineWidth(0.2)
      doc.rect(ML, top, CW, rowH)
      doc.line(ML + LABEL_W, top, ML + LABEL_W, top + rowH)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(85, 72, 50)
      labLines.forEach((l: string, i: number) => doc.text(l, ML + 2.5, top + 4 + i * lh))
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)
      valLines.forEach((l: string, i: number) => doc.text(l, ML + LABEL_W + 2.5, top + 4 + i * lh))
      y = top + rowH
    }
    // Igual que tableRow pero la columna de valor es una lista de viñetas (separadas por " • " en la BD).
    const tableRowBullets = (label: string, items: string[]) => {
      doc.setFontSize(9)
      const lh = 9 * 0.46
      const valW = CW - LABEL_W - 5
      const bulletIndent = 4
      const wrapped = items.map((it) => doc.splitTextToSize(it, valW - bulletIndent))
      const labLines = doc.splitTextToSize(label, LABEL_W - 5)
      const gapBetween = 1.2
      const totalValH = wrapped.reduce((s, w) => s + w.length * lh, 0) + (items.length - 1) * gapBetween
      const rowH = Math.max(totalValH, labLines.length * lh) + 4
      ensure(rowH)
      const top = y
      doc.setFillColor(241, 236, 226); doc.rect(ML, top, LABEL_W, rowH, 'F')
      doc.setDrawColor(223, 216, 202); doc.setLineWidth(0.2)
      doc.rect(ML, top, CW, rowH)
      doc.line(ML + LABEL_W, top, ML + LABEL_W, top + rowH)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(85, 72, 50)
      labLines.forEach((l: string, i: number) => doc.text(l, ML + 2.5, top + 4 + i * lh))
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)
      const vx = ML + LABEL_W + 2.5
      let ty = top + 4
      for (const w of wrapped) {
        doc.text('•', vx, ty)
        w.forEach((l: string, i: number) => doc.text(l, vx + bulletIndent, ty + i * lh))
        ty += w.length * lh + gapBetween
      }
      y = top + rowH
    }
    // Renderiza el texto de Protección de datos como tabla, leído de la BD: cada línea
    // "Etiqueta: valor" es una fila; el título va arriba y la frase final (sin etiqueta) debajo.
    // Texto de un consentimiento: ancho completo (ML→margen dcho), 9pt, justificado.
    const consentBody = (text: string) => {
      const size = 9, lh = size * 0.46
      const lines = doc.splitTextToSize(text || '', CW)
      for (let i = 0; i < lines.length; i++) {
        ensure(lh + 2)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(70, 70, 70)
        const justify = i < lines.length - 1 && lines[i].trim() !== '' && (lines[i + 1] || '').trim() !== ''
        if (justify) drawJustifiedLine(doc, lines[i], ML, y, CW)
        else doc.text(lines[i], ML, y)
        y += lh
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
      y += 2
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

    // ===== Portada (página 1): marca + título + introducción =====
    runningHeader()
    doc.setFont('times', 'bold'); doc.setFontSize(24); doc.setTextColor(35, 35, 35)
    doc.text('PODIUM', PW / 2, 24, { align: 'center' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(180, 140, 45); doc.setCharSpace(1.4)
    doc.text('FISIOTERAPIA DE PRECISIÓN · ZARAGOZA', PW / 2, 30, { align: 'center' }); doc.setCharSpace(0)
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

    // ===== 4. Ficha del deportista (datos + lesiones + estado, al final) =====
    heading('4. Ficha del deportista')
    const rowsD: [string, number][][] = [
      [['Nombre y apellidos:', CW]],
      [['DNI / documento:', 85], ['Fecha de nacimiento:', 85]],
      [['Sexo:', 55], ['Equipo / club:', 115]],
      [['Posición:', 55], ['Lateralidad (pierna/brazo):', 115]],
      [['Altura (cm):', 55], ['Peso (kg):', 55]],
    ]
    for (const row of rowsD) {
      ensure(9)
      let x = ML
      for (const [label, w] of row) { fieldLine(label, x, w); x += w + 6 }
      y += 9
    }
    y += 2
    // Subsección: historial de lesiones
    para('Historial de lesiones (últimos 24 meses)', { size: 10, style: 'bold', color: [40, 40, 40], gap: 1 })
    para('Indica zona, tipo de lesión, fecha aproximada y si requirió baja deportiva o cirugía.', { size: 8.5, color: [120, 120, 120] })
    ensure(10)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90)
    doc.text('Zona', ML, y); doc.text('Tipo de lesión', ML + 55, y); doc.text('Fecha aprox.', ML + 100, y); doc.text('Baja / Cirugía', ML + 140, y)
    y += 2
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.2)
    for (let i = 0; i < 4; i++) { ensure(9); doc.line(ML, y + 6, PW - MR, y + 6); y += 9 }
    y += 3
    // Subsección: estado actual
    para('Estado actual', { size: 10, style: 'bold', color: [40, 40, 40], gap: 1 })
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2)
    para('¿Tienes actualmente dolor o molestia en alguna zona? Indícalo:', { size: 9, gap: 1 })
    for (let i = 0; i < 2; i++) { ensure(8); doc.line(ML, y + 4, PW - MR, y + 4); y += 8 }
    y += 1
    para('¿Tomas alguna medicación, tienes alguna patología, embarazo o intervención reciente relevante?', { size: 9, gap: 1 })
    for (let i = 0; i < 2; i++) { ensure(8); doc.line(ML, y + 4, PW - MR, y + 4); y += 8 }
    y += 2
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
