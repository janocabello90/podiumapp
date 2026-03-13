import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'

interface ReportData {
  portada_intro: string
  resumen_anamnesis: string
  exploracion_fisica: {
    introduccion: string
    exploracion_visual: string
    palpacion: string
    sensibilidad: string
    movilidad: string
    tests_ortopedicos: string
    fuerza: string
    hallazgos: string
  }
  conclusiones: string
  descargo: string
}

interface DocumentAttachment {
  id: string
  file_name: string
  storage_path: string
}

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

function addHeader(doc: jsPDF, logoDataUrl?: string | null, logoExt?: string) {
  if (logoDataUrl && logoExt) {
    // Logo centered in header, max 30mm wide x 12mm tall
    doc.addImage(logoDataUrl, logoExt, PAGE_WIDTH / 2 - 15, 8, 30, 12)
  }

  // Gold underline
  doc.setDrawColor(218, 165, 32)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, 24, PAGE_WIDTH - MARGIN_RIGHT, 24)
}

// Module-level variables for logo in headers (set once per request)
let _headerLogoDataUrl: string | null = null
let _headerLogoExt: string | null = null

function writeParagraph(doc: jsPDF, text: string, y: number, options?: { fontSize?: number; fontStyle?: string; color?: number[] }): number {
  const fontSize = options?.fontSize || 10
  const fontStyle = options?.fontStyle || 'normal'
  const color = options?.color || [60, 60, 60]

  doc.setFont('helvetica', fontStyle)
  doc.setFontSize(fontSize)
  doc.setTextColor(color[0], color[1], color[2])

  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  const lineHeight = fontSize * 0.45

  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - MARGIN_BOTTOM - 10) {
      addFooter(doc)
      doc.addPage()
      addHeader(doc, _headerLogoDataUrl, _headerLogoExt)
      y = MARGIN_TOP + 10
    }
    doc.text(line, MARGIN_LEFT, y)
    y += lineHeight
  }

  return y + 3
}

function writeSectionTitle(doc: jsPDF, title: string, y: number): number {
  if (y > doc.internal.pageSize.getHeight() - MARGIN_BOTTOM - 30) {
    addFooter(doc)
    doc.addPage()
    addHeader(doc, _headerLogoDataUrl, _headerLogoExt)
    y = MARGIN_TOP + 10
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 30, 30)
  doc.text(title, MARGIN_LEFT, y)
  y += 3

  // Underline
  doc.setDrawColor(218, 165, 32)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)

  return y + 8
}

function writeSubsectionTitle(doc: jsPDF, title: string, y: number): number {
  if (y > doc.internal.pageSize.getHeight() - MARGIN_BOTTOM - 20) {
    addFooter(doc)
    doc.addPage()
    addHeader(doc, _headerLogoDataUrl, _headerLogoExt)
    y = MARGIN_TOP + 10
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(50, 50, 50)
  doc.text(title, MARGIN_LEFT, y)
  return y + 5
}

export async function POST(request: NextRequest) {
  try {
    const { reportData, patientName, patientDob, patientGender, documents, clinicLogoUrl } = await request.json() as {
      reportData: ReportData
      patientName: string
      patientDob: string | null
      patientGender: string | null
      documents?: DocumentAttachment[]
      clinicLogoUrl?: string | null
    }

    const doc = new jsPDF('portrait', 'mm', 'a4')

    // ===== PAGE 1: COVER =====

    // Reset logo globals
    _headerLogoDataUrl = null
    _headerLogoExt = null

    // If clinic has a logo, load it for cover and headers
    let coverY = 45
    if (clinicLogoUrl) {
      try {
        const logoResponse = await fetch(clinicLogoUrl)
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer()
          const logoBase64 = Buffer.from(logoBuffer).toString('base64')
          const contentType = logoResponse.headers.get('content-type') || 'image/png'
          const ext = contentType.includes('png') ? 'PNG' : contentType.includes('svg') ? 'PNG' : 'JPEG'
          const logoDataUrl = `data:${contentType};base64,${logoBase64}`

          // Save for headers on subsequent pages
          _headerLogoDataUrl = logoDataUrl
          _headerLogoExt = ext

          // Add logo centered on cover, max 50mm wide x 25mm tall
          doc.addImage(logoDataUrl, ext, PAGE_WIDTH / 2 - 25, 15, 50, 25)
          coverY = 48
        }
      } catch (e) {
        console.error('Logo load error:', e)
      }
    }

    // Gold line under logo
    doc.setDrawColor(218, 165, 32)
    doc.setLineWidth(0.8)
    doc.line(MARGIN_LEFT, coverY + 2, PAGE_WIDTH - MARGIN_RIGHT, coverY + 2)

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(30, 30, 30)
    doc.text('INFORME VALORACIÓN INTEGRAL AVANZADA', PAGE_WIDTH / 2, coverY + 18, { align: 'center' })

    // Patient data
    let y = coverY + 32
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(50, 50, 50)
    doc.text(`Nombre completo: `, MARGIN_LEFT, y)
    doc.setFont('helvetica', 'normal')
    doc.text(patientName, MARGIN_LEFT + 38, y)
    y += 6

    if (patientDob) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Fecha de nacimiento: `, MARGIN_LEFT, y)
      doc.setFont('helvetica', 'normal')
      doc.text(patientDob, MARGIN_LEFT + 42, y)
      y += 6
    }

    if (patientGender) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Sexo: `, MARGIN_LEFT, y)
      doc.setFont('helvetica', 'normal')
      const genderText = patientGender === 'male' ? 'Hombre' : patientGender === 'female' ? 'Mujer' : 'Otro'
      doc.text(genderText, MARGIN_LEFT + 12, y)
      y += 6
    }

    // Line separator
    y += 4
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
    y += 10

    // Intro text
    y = writeParagraph(doc, reportData.portada_intro, y)

    addFooter(doc)

    // ===== PAGE 2: ANAMNESIS =====
    doc.addPage()
    addHeader(doc, _headerLogoDataUrl, _headerLogoExt)
    y = MARGIN_TOP + 10

    y = writeSectionTitle(doc, 'RESUMEN DE LA ANAMNESIS', y)
    y = writeParagraph(doc, reportData.resumen_anamnesis, y)

    addFooter(doc)

    // ===== PAGE 3+: EXPLORACIÓN =====
    doc.addPage()
    addHeader(doc, _headerLogoDataUrl, _headerLogoExt)
    y = MARGIN_TOP + 10

    y = writeSectionTitle(doc, 'EXPLORACIÓN FÍSICA', y)

    y = writeParagraph(doc, reportData.exploracion_fisica.introduccion, y, { fontStyle: 'italic' })
    y += 3

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text('INFORMACIÓN RELEVANTE', MARGIN_LEFT, y)
    y += 7

    y = writeSubsectionTitle(doc, 'Exploración visual (estática y biomecánica)', y)
    y = writeParagraph(doc, reportData.exploracion_fisica.exploracion_visual, y)
    y += 2

    y = writeSubsectionTitle(doc, 'Palpación', y)
    y = writeParagraph(doc, reportData.exploracion_fisica.palpacion, y)
    y += 2

    y = writeSubsectionTitle(doc, 'Exploración de la sensibilidad', y)
    y = writeParagraph(doc, reportData.exploracion_fisica.sensibilidad, y)
    y += 2

    y = writeSubsectionTitle(doc, 'Valoración de la movilidad', y)
    y = writeParagraph(doc, reportData.exploracion_fisica.movilidad, y)
    y += 2

    y = writeSubsectionTitle(doc, 'Test ortopédicos', y)
    y = writeParagraph(doc, reportData.exploracion_fisica.tests_ortopedicos, y)
    y += 2

    y = writeSubsectionTitle(doc, 'Valoración de la fuerza', y)
    y = writeParagraph(doc, reportData.exploracion_fisica.fuerza, y)
    y += 4

    // Hallazgos box
    y = writeSubsectionTitle(doc, 'HALLAZGOS', y)
    y = writeParagraph(doc, reportData.exploracion_fisica.hallazgos, y)

    addFooter(doc)

    // ===== CONCLUSIONES =====
    doc.addPage()
    addHeader(doc, _headerLogoDataUrl, _headerLogoExt)
    y = MARGIN_TOP + 10

    y = writeSectionTitle(doc, 'CONCLUSIONES FINALES', y)
    y = writeParagraph(doc, reportData.conclusiones, y)

    // Descargo
    y += 8
    if (y > doc.internal.pageSize.getHeight() - MARGIN_BOTTOM - 50) {
      addFooter(doc)
      doc.addPage()
      addHeader(doc, _headerLogoDataUrl, _headerLogoExt)
      y = MARGIN_TOP + 10
    }

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
    y += 8

    y = writeParagraph(doc, 'Descargo de responsabilidad:', y, { fontStyle: 'bolditalic', fontSize: 9, color: [100, 100, 100] })
    y = writeParagraph(doc, reportData.descargo, y, { fontStyle: 'italic', fontSize: 8, color: [120, 120, 120] })

    addFooter(doc)

    // ===== METHODOLOGY PAGE =====
    doc.addPage()
    addHeader(doc, _headerLogoDataUrl, _headerLogoExt)
    y = MARGIN_TOP + 10

    y = writeSectionTitle(doc, 'NUESTRA METODOLOGÍA', y)
    y += 5

    // Draw the 5 PODIO stages
    const stages = [
      { num: '1', title: 'ALIVIO DEL DOLOR', desc: 'Regulación del dolor y recuperación de la confianza' },
      { num: '2', title: 'RECUPERACIÓN DEL TEJIDO Y LA MOVILIDAD', desc: 'Sanar la base y restaurar movilidad sin dolor' },
      { num: '3', title: 'REEDUCACIÓN DEL MOVIMIENTO', desc: 'Corregir patrones y mejorar el control corporal' },
      { num: '4', title: 'RESTAURAR LA FUERZA', desc: 'Recuperar capacidad de carga y tolerancia al esfuerzo' },
      { num: '5', title: 'MOVIMIENTO CON PROPÓSITO', desc: 'Autonomía, prevención y vida sin limitaciones' },
    ]

    for (let i = stages.length - 1; i >= 0; i--) {
      const stage = stages[i]
      const boxY = y + (4 - i) * 28

      // Box
      doc.setDrawColor(218, 165, 32)
      doc.setLineWidth(0.5)
      doc.setFillColor(255, 250, 235)
      doc.roundedRect(MARGIN_LEFT + 10, boxY, CONTENT_WIDTH - 20, 22, 3, 3, 'FD')

      // PODIO number
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(218, 165, 32)
      doc.text(`PODIO ${stage.num}`, MARGIN_LEFT + 16, boxY + 9)

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)
      doc.text(stage.title, MARGIN_LEFT + 40, boxY + 9)

      // Description
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(stage.desc, MARGIN_LEFT + 40, boxY + 16)
    }

    addFooter(doc)

    // Generate the main report PDF buffer
    const mainPdfBytes = Buffer.from(doc.output('arraybuffer'))

    // ===== MERGE VALD DOCUMENTS AS ANNEXES =====
    const valdDocs = documents || []
    if (valdDocs.length > 0) {
      try {
        // Create merged PDF using pdf-lib
        const mergedPdf = await PDFDocument.load(mainPdfBytes)

        // Add an ANNEXES cover page
        const annexPage = mergedPdf.addPage([595.28, 841.89]) // A4 in points
        const { width: aw, height: ah } = annexPage.getSize()

        // Simple ANEXOS title on the page
        annexPage.drawText('ANEXOS', {
          x: aw / 2 - 40,
          y: ah / 2 + 20,
          size: 28,
        })
        annexPage.drawText('Documentación complementaria VALD', {
          x: aw / 2 - 120,
          y: ah / 2 - 15,
          size: 12,
        })

        // Download and merge each VALD document
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

        if (serviceRoleKey && supabaseUrl) {
          const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          })

          for (const valdDoc of valdDocs) {
            try {
              // Download the VALD PDF from Supabase Storage
              const { data: fileData, error: downloadError } = await adminSupabase
                .storage
                .from('documents')
                .download(valdDoc.storage_path)

              if (downloadError || !fileData) {
                console.error(`Failed to download ${valdDoc.file_name}:`, downloadError)
                continue
              }

              const valdPdfBytes = await fileData.arrayBuffer()

              // Try to load as PDF and merge pages
              try {
                const valdPdf = await PDFDocument.load(valdPdfBytes)
                const valdPages = await mergedPdf.copyPages(valdPdf, valdPdf.getPageIndices())
                valdPages.forEach(page => mergedPdf.addPage(page))
              } catch (pdfError) {
                // If not a valid PDF (could be an image), add as image on new page
                console.error(`${valdDoc.file_name} is not a valid PDF, skipping merge:`, pdfError)

                // Add a placeholder page mentioning the document
                const placeholderPage = mergedPdf.addPage([595.28, 841.89])
                placeholderPage.drawText(`Documento: ${valdDoc.file_name}`, {
                  x: 50,
                  y: 780,
                  size: 14,
                })
                placeholderPage.drawText('(El archivo adjunto no pudo ser incorporado como PDF)', {
                  x: 50,
                  y: 750,
                  size: 10,
                })
              }
            } catch (e) {
              console.error(`Error processing ${valdDoc.file_name}:`, e)
            }
          }
        }

        // Save merged PDF
        const mergedPdfBytes = await mergedPdf.save()

        return new NextResponse(Buffer.from(mergedPdfBytes), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Informe_PODIUM_${patientName.replace(/\s+/g, '_')}.pdf"`,
          },
        })
      } catch (mergeError) {
        console.error('PDF merge error, returning main PDF only:', mergeError)
        // Fall through to return main PDF without annexes
      }
    }

    // Return main PDF (without annexes, or if merge failed)
    return new NextResponse(mainPdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Informe_PODIUM_${patientName.replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('PDF export error:', error)
    return NextResponse.json({ error: error.message || 'Error al generar PDF' }, { status: 500 })
  }
}
