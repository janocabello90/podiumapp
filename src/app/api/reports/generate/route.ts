import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `Eres un fisioterapeuta clínico experto redactando informes de valoración integral para Clínica PODIUM. Escribes en español clínico profesional, dirigiéndote al paciente con cercanía pero rigor.

ESTRUCTURA DEL INFORME que debes generar (en formato JSON con las secciones):

1. "portada_intro": Texto introductorio para la portada. Explica que el informe recoge la información de la Valoración Integral Avanzada PODIUM. Menciona la metodología propia de PODIUM (entender qué está limitando la capacidad, no solo identificar una lesión). Incluye que a lo largo del informe encontrará: resumen de anamnesis, hallazgos de exploración, resultados objetivos, explicación integrada y recomendación de itinerario. Termina con el compromiso de acompañar con criterio clínico, claridad y planificación coherente. Adapta el texto al caso concreto del paciente.

2. "resumen_anamnesis": Resumen narrativo en 2-3 párrafos de la anamnesis. Describe el motivo de consulta, la cronología, los síntomas, el contexto laboral/personal, tratamientos previos, y el enfoque de la valoración. Redacta en tercera persona refiriéndote al paciente por su nombre.

3. "exploracion_fisica": Objeto con:
   - "introduccion": Párrafo introductorio explicando qué se ha valorado
   - "exploracion_visual": Hallazgos de la inspección estática y biomecánica
   - "palpacion": Hallazgos de la palpación
   - "sensibilidad": Exploración de la sensibilidad
   - "movilidad": Valoración de la movilidad activa y pasiva
   - "tests_ortopedicos": Resultados de los tests ortopédicos específicos
   - "fuerza": Valoración de la fuerza muscular
   - "hallazgos": Resumen integrado de los hallazgos más relevantes de la exploración

4. "conclusiones": Texto extenso (3-4 párrafos) que integre TODA la información (anamnesis + exploración + datos funcionales si los hay). Debe:
   - Primer párrafo: visión global integrando todos los datos
   - Segundo párrafo: hallazgos más relevantes con datos específicos
   - Tercer párrafo: hipótesis diagnósticas (usar "posible" o "compatible con", NUNCA diagnóstico definitivo). Marcar las hipótesis en negrita.
   - Cuarto párrafo: plan terapéutico alineado con el Método Podium™ describiendo las 5 fases adaptadas al caso:
     * Fase 1 "Alivio del dolor": regular dolor y modular sensibilidad
     * Fase 2 "Recuperación del tejido y la movilidad": mejorar calidad tisular y movilidad
     * Fase 3 "Reeducación del movimiento": corregir patrones y control motor
     * Fase 4 "Restaurar la fuerza": recuperar capacidad de carga y simetría
     * Fase 5 "Movimiento con propósito": consolidar cambios, prevención y autonomía
   Adapta cada fase al caso concreto del paciente.

5. "descargo": El descargo de responsabilidad estándar (este es siempre igual): "El presente informe ha sido elaborado conforme al Método Podium™, un sistema de valoración clínica propio de la fisioterapia orientado a la evaluación del dolor, el movimiento, la capacidad y la función desde un enfoque clínico-funcional y biopsicosocial. Este documento no constituye un diagnóstico médico, no sustituye la valoración realizada por un facultativo médico y no debe interpretarse como informe pericial ni como prueba válida en procedimientos judiciales, administrativos, aseguradores o legales. La información y los datos objetivos recogidos tienen como finalidad guiar el proceso terapéutico, apoyar la toma de decisiones clínicas en fisioterapia y facilitar la comprensión del estado funcional del paciente en el momento de la valoración. Cualquier uso fuera del ámbito asistencial para el que ha sido diseñado queda expresamente desaconsejado."

REGLAS:
- Escribe en español profesional clínico, pero comprensible para el paciente.
- Usa párrafos narrativos, NO bullet points (excepto en la portada donde se listan los contenidos del informe).
- Refiere al paciente por su nombre de pila.
- NO inventes datos que no estén en la información proporcionada.
- Si no hay datos de alguna sección de exploración, indica que no se han registrado hallazgos en esa área.
- Las hipótesis diagnósticas siempre con "posible", "compatible con" o "sugiere".
- El tono es cercano pero riguroso, como un profesional que explica al paciente su situación.
- Responde SOLO con el JSON válido, sin texto adicional.`

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key de Anthropic no configurada' }, { status: 500 })
    }

    const supabase = createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { patientId } = await request.json()
    if (!patientId) {
      return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })
    }

    // Fetch all patient data
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select(`
        *,
        anamnesis_forms(*),
        assessments(*),
        documents(*)
      `)
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
    }

    // Build context for Claude
    const anamnesis = patient.anamnesis_forms?.[0]
    const assessment = patient.assessments?.[0]
    const documents = patient.documents || []

    let patientContext = `DATOS DEL PACIENTE:
- Nombre: ${patient.full_name}
- Fecha de nacimiento: ${patient.date_of_birth || 'No especificada'}
- Sexo: ${patient.gender === 'male' ? 'Hombre' : patient.gender === 'female' ? 'Mujer' : 'No especificado'}
`

    if (anamnesis?.form_data) {
      const fd = anamnesis.form_data
      // Filter out verification metadata keys
      const anamnesisData = Object.entries(fd)
        .filter(([key]) => !key.startsWith('_verified_') && !key.startsWith('_edited_') && !key.startsWith('_original_') && !key.startsWith('_notes_'))
        .map(([key, value]) => `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join('\n')

      // Also include physio notes if any
      const physioNotes = Object.entries(fd)
        .filter(([key]) => key.startsWith('_notes_'))
        .filter(([, value]) => value && String(value).trim())
        .map(([key, value]) => `  Nota del fisio sobre "${key.replace('_notes_', '')}": ${value}`)
        .join('\n')

      patientContext += `\nDATOS DE LA ANAMNESIS:\n${anamnesisData}`
      if (physioNotes) {
        patientContext += `\n\nNOTAS DEL FISIOTERAPEUTA EN LA ANAMNESIS:\n${physioNotes}`
      }
    }

    if (assessment?.assessment_data) {
      const ad = assessment.assessment_data
      const assessmentEntries = Object.entries(ad)
        .map(([key, value]) => `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join('\n')
      patientContext += `\n\nDATOS DE LA EXPLORACIÓN FÍSICA / VALORACIÓN:\n${assessmentEntries}`

      if (assessment.notes) {
        patientContext += `\n\nNOTAS GENERALES DE LA VALORACIÓN:\n${assessment.notes}`
      }
    }

    // VALD interpretation from patient record
    if (patient.vald_interpretation) {
      patientContext += `\n\nINTERPRETACIÓN DEL FISIOTERAPEUTA SOBRE INFORMES VALD:\n${patient.vald_interpretation}`
    }

    if (documents.length > 0) {
      const valdDocs = documents.filter((d: any) => d.doc_type !== 'medical_image')
      const imageDocs = documents.filter((d: any) => d.doc_type === 'medical_image')

      const docNotes = valdDocs
        .filter((d: any) => d.extracted_data?.notes)
        .map((d: any) => `  ${d.file_name}: ${d.extracted_data.notes}`)
        .join('\n')

      if (docNotes) {
        patientContext += `\n\nNOTAS DE INFORMES VALD/DOCUMENTOS:\n${docNotes}`
      }

      if (valdDocs.length > 0) {
        patientContext += `\n\nSe han subido ${valdDocs.length} informe(s) de valoración funcional VALD.`
      }

      // Image captions (ecografías, fotografías clínicas)
      const imageCaptions = imageDocs
        .filter((d: any) => {
          const meta = d.extracted_data?.notes ? (typeof d.extracted_data.notes === 'string' ? (() => { try { return JSON.parse(d.extracted_data.notes) } catch { return null } })() : d.extracted_data.notes) : null
          return meta?.caption
        })
        .map((d: any) => {
          const meta = typeof d.extracted_data.notes === 'string' ? JSON.parse(d.extracted_data.notes) : d.extracted_data.notes
          return `  ${d.file_name}: ${meta.caption}`
        })
        .join('\n')

      if (imageCaptions) {
        patientContext += `\n\nDESCRIPCIONES DE IMÁGENES CLÍNICAS (ecografías/fotografías):\n${imageCaptions}`
      }

      if (imageDocs.length > 0) {
        const includedImages = imageDocs.filter((d: any) => {
          const meta = d.extracted_data?.notes ? (typeof d.extracted_data.notes === 'string' ? (() => { try { return JSON.parse(d.extracted_data.notes) } catch { return null } })() : d.extracted_data.notes) : null
          return meta?.include_in_report !== false
        })
        patientContext += `\n\nSe han subido ${imageDocs.length} imagen(es) clínica(s), de las cuales ${includedImages.length} se incluirán en el informe.`
      }
    }

    // Call Claude
    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Genera el informe de Valoración Integral Avanzada PODIUM para este paciente. Responde SOLO con JSON válido.\n\n${patientContext}`
        }
      ],
    })

    // Extract text from response
    const responseText = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')

    // Parse JSON
    let reportData
    try {
      // Try to extract JSON if wrapped in markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText
      reportData = JSON.parse(jsonStr.trim())
    } catch {
      console.error('Failed to parse Claude response:', responseText.substring(0, 500))
      return NextResponse.json({ error: 'Error al procesar la respuesta de IA' }, { status: 500 })
    }

    // Save report to database
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        patient_id: patientId,
        clinic_id: patient.clinic_id,
        generated_by: user.id,
        status: 'draft',
        anamnesis_id: anamnesis?.id || null,
        assessment_id: assessment?.id || null,
        report_data: reportData,
        ai_model: 'claude-sonnet-4-20250514',
        ai_prompt_tokens: message.usage?.input_tokens || null,
        ai_completion_tokens: message.usage?.output_tokens || null,
      })
      .select()
      .single()

    if (reportError) {
      console.error('Report save error:', reportError)
      return NextResponse.json({ error: 'Error al guardar el informe' }, { status: 500 })
    }

    return NextResponse.json({ report })
  } catch (error: any) {
    console.error('Report generation error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
