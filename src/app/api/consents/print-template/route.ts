import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { drawJustifiedLine } from '@/lib/reports/pdfJustify'

// PDF "Anamnesis + consentimientos (EN BLANCO)" para imprimir y rellenar a mano.
// Se genera desde los mismos textos de consent_versions → nunca se descuadra con la app.

const ML = 20, MR = 20, MT = 22, MB = 18, PW = 210
const CW = PW - ML - MR
const FOOTER = 'www.clinicapodium.com  -  608392019  -  C/ Almagro 16 50004 Zaragoza'

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
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const [{ data: clinic }, { data: versions }] = await Promise.all([
      supabase.from('clinics').select('name').eq('id', profile.clinic_id).single(),
      supabase.from('consent_versions').select('type, body').eq('clinic_id', profile.clinic_id).eq('is_active', true),
    ])
    const texts = new Map((versions || []).map((v: any) => [v.type, v.body as string]))
    const clinicName = clinic?.name || 'Clínica Podium'

    const doc = new jsPDF('portrait', 'mm', 'a4')
    let y = 0

    const addFooter = () => {
      const h = doc.internal.pageSize.getHeight()
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150)
      doc.text(FOOTER, PW / 2, h - 10, { align: 'center' })
    }
    const header = () => {
      doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.4); doc.line(ML, MT - 4, PW - MR, MT - 4)
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
      ensure(14)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 30, 30)
      doc.text(t, ML, y); y += 2
      doc.setDrawColor(218, 165, 32); doc.setLineWidth(0.3); doc.line(ML, y, PW - MR, y); y += 6
    }
    // Etiqueta + línea en blanco para rellenar a mano.
    const fieldLine = (label: string, x: number, w: number) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90)
      doc.text(label, x, y)
      const lx = x + doc.getTextWidth(label) + 2
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2); doc.line(lx, y + 0.5, x + w, y + 0.5)
    }
    const checkbox = (yy: number) => {
      doc.setDrawColor(90, 90, 90); doc.setLineWidth(0.35); doc.rect(ML, yy - 3, 3.6, 3.6)
    }
    // Fila de tabla "Etiqueta | valor" (capa básica de Protección de datos).
    const LABEL_W = 44
    const tableRow = (label: string, value: string) => {
      doc.setFontSize(9)
      const lh = 9 * 0.46
      const valLines = doc.splitTextToSize(value || '', CW - LABEL_W - 4)
      const labLines = doc.splitTextToSize(label, LABEL_W - 3)
      const rowH = Math.max(valLines.length, labLines.length) * lh + 3
      ensure(rowH)
      const top = y
      doc.setDrawColor(215, 215, 215); doc.setLineWidth(0.2)
      doc.rect(ML, top, CW, rowH)
      doc.line(ML + LABEL_W, top, ML + LABEL_W, top + rowH)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(70, 70, 70)
      labLines.forEach((l: string, i: number) => doc.text(l, ML + 2, top + 3 + i * lh))
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)
      valLines.forEach((l: string, i: number) => doc.text(l, ML + LABEL_W + 2, top + 3 + i * lh))
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
        if (isRow) { tableRow(line.slice(0, idx).trim(), cap(line.slice(idx + 1).trim())); seenRow = true }
        else if (!seenRow) { para(line, { size: 8.5, style: 'bold', color: [70, 70, 70], gap: 1 }) }
        else { after.push(line) }
      }
      y += 2
      if (after.length) consentBody(after.join(' '))
    }

    // ===== Portada / cabecera =====
    header()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(30, 30, 30)
    doc.text('ANAMNESIS Y CONSENTIMIENTOS', PW / 2, y + 4, { align: 'center' }); y += 10
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
    doc.text('Valoración funcional · Metodología Podium®', PW / 2, y, { align: 'center' }); y += 8
    para(`Centro sanitario: FISIO ZARAGOZA, S.L. — CIF B99562720 — Nº de registro sanitario [Nº REGISTRO SANITARIO] — C/ Almagro 16, 50004 Zaragoza.`, { size: 8.5, color: [110, 110, 110] })
    y += 2
    fieldLine('Fisioterapeuta:', ML, 95); fieldLine('Nº colegiado:', ML + 100, CW); y += 8
    fieldLine('Fecha:', ML, 60); y += 8

    // ===== 1. Consentimientos (primero, como el documento original) =====
    heading('1. Consentimientos')
    para('Marca las casillas. Los marcados como obligatorios son necesarios para realizar la valoración.', { size: 8.5, color: [120, 120, 120] })
    for (const c of CONSENT_ORDER) {
      const body = texts.get(c.type)
      if (!body) continue
      ensure(16)
      checkbox(y)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40)
      doc.text(`${c.label}${c.obligatorio ? '  (obligatorio)' : '  (opcional)'}`, ML + 6, y)
      y += 6
      if (c.type === 'data_processing') {
        // Capa básica de Protección de datos: como tabla, leyendo el texto de la BD.
        renderDataProcessing(body)
      } else {
        consentBody(body)
      }
      y += 4
    }

    // ===== 2. Datos del deportista (en blanco) =====
    heading('2. Datos del deportista')
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

    // ===== 3. Historial de lesiones =====
    heading('3. Historial de lesiones (últimos 24 meses)')
    para('Indica zona, tipo de lesión, fecha aproximada y si requirió baja deportiva o cirugía.', { size: 8.5, color: [120, 120, 120] })
    ensure(10)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90)
    doc.text('Zona', ML, y); doc.text('Tipo de lesión', ML + 55, y); doc.text('Fecha aprox.', ML + 100, y); doc.text('Baja / Cirugía', ML + 140, y)
    y += 2
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.2)
    for (let i = 0; i < 4; i++) { ensure(9); doc.line(ML, y + 6, PW - MR, y + 6); y += 9 }
    y += 2

    // ===== 4. Estado actual =====
    heading('4. Estado actual')
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2)
    para('¿Tienes actualmente dolor o molestia en alguna zona? Indícalo:', { size: 9, gap: 1 })
    for (let i = 0; i < 2; i++) { ensure(8); doc.line(ML, y + 4, PW - MR, y + 4); y += 8 }
    y += 1
    para('¿Tomas alguna medicación, tienes alguna patología, embarazo o intervención reciente relevante?', { size: 9, gap: 1 })
    for (let i = 0; i < 2; i++) { ensure(8); doc.line(ML, y + 4, PW - MR, y + 4); y += 8 }
    y += 2

    // ===== 5. Firma =====
    heading('5. Firma')
    para('Deportista mayor de edad:', { size: 9, style: 'bold', gap: 3 })
    ensure(16)
    fieldLine('Firma:', ML, 90); fieldLine('Fecha:', ML + 100, CW); y += 14
    para('Representante legal (si el deportista es menor de edad):', { size: 9, style: 'bold', gap: 3 })
    ensure(20)
    fieldLine('Nombre:', ML, 90); fieldLine('DNI:', ML + 100, CW); y += 9
    fieldLine('Relación (padre/madre/tutor):', ML, 90); y += 9
    fieldLine('Firma:', ML, 90); fieldLine('Fecha:', ML + 100, CW); y += 6
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
