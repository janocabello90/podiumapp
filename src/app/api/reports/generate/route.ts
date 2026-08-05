import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
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

5. "descargo": El descargo de responsabilidad estándar (este es siempre igual): "El presente informe ha sido elaborado conforme al Método Podium™, un sistema de valoración clínica propio de la fisioterapia orientado a la evaluación del dolor, el movimiento, la capacidad y la función desde un enfoque clínico-funcional y biopsicosocial. La redacción de este documento ha sido asistida por un sistema de inteligencia artificial (Anthropic Claude, vía API) como herramienta de soporte, y ha sido íntegramente revisado, editado y aprobado por un fisioterapeuta colegiado antes de su emisión. El proveedor de IA no almacena ni reutiliza los datos del paciente. Este documento no constituye un diagnóstico médico, no sustituye la valoración realizada por un facultativo médico y no debe interpretarse como informe pericial ni como prueba válida en procedimientos judiciales, administrativos, aseguradores o legales. La información y los datos objetivos recogidos tienen como finalidad guiar el proceso terapéutico, apoyar la toma de decisiones clínicas en fisioterapia y facilitar la comprensión del estado funcional del paciente en el momento de la valoración. Cualquier uso fuera del ámbito asistencial para el que ha sido diseñado queda expresamente desaconsejado."

REGLAS:
- Escribe en español profesional clínico, pero comprensible para el paciente.
- Usa párrafos narrativos, NO bullet points (excepto en la portada donde se listan los contenidos del informe).
- Refiere al paciente por su nombre de pila.
- NO inventes datos que no estén en la información proporcionada.
- Si no hay datos de alguna sección de exploración, indica que no se han registrado hallazgos en esa área.
- Las hipótesis diagnósticas siempre con "posible", "compatible con" o "sugiere".
- El tono es cercano pero riguroso, como un profesional que explica al paciente su situación.
- Si se adjuntan documentos a este mensaje (informes/gráficas de VALD, ecografías, imágenes clínicas), LÉELOS e interpreta sus RESULTADOS OBJETIVOS: valores por lado (izq/der), asimetrías (%), potencia/fuerza, percentiles y hallazgos de imagen. Integra esos datos y su interpretación (cruzándolos con las notas del fisio y la guía de interpretación de cada prueba) en "exploracion_fisica.fuerza"/"hallazgos" y, sobre todo, en "conclusiones". No te limites a mencionar que existen: interpreta lo que muestran.
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

    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { patientId, sessionId } = await request.json()
    if (!patientId) {
      return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })
    }

    // Fetch all patient data (enforce clinic isolation)
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select(`
        *,
        anamnesis_forms(*),
        assessments(*),
        sessions(*),
        documents(*)
      `)
      .eq('id', patientId)
      .eq('clinic_id', profile.clinic_id)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
    }

    // Build context for Claude
    const anamnesis = patient.anamnesis_forms?.[0]
    const assessment = patient.assessments?.[0]
    // Fase F: si viene sessionId, usar ESA sesión; si no, la última (Fase D). Fallback a assessment legacy.
    const allSessions = (patient.sessions as any[]) || []
    const session = sessionId
      ? allSessions.find((s: any) => s.id === sessionId)
      : allSessions.sort((a: any, b: any) => (b.session_number || 0) - (a.session_number || 0))[0]

    if (sessionId && !session) {
      return NextResponse.json({ error: 'Sesión no encontrada para este paciente' }, { status: 404 })
    }

    const clinicalData = session?.clinical_data ?? assessment?.assessment_data
    const clinicalNotes = session?.notes ?? assessment?.notes

    // Fase F: pruebas de la sesión (notas por prueba + prompt VALD por prueba) y
    // documentos vinculados a la sesión. Si la sesión no tiene documentos propios,
    // se cae a los documentos a nivel paciente (retrocompatibilidad).
    let sessionTests: any[] = []
    let documents = patient.documents || []
    if (session?.id) {
      const [{ data: st }, { data: sessionDocs }] = await Promise.all([
        supabase
          .from('session_tests')
          .select('test_name, notes, status, display_order, tests(vald_interpretation_prompt)')
          .eq('session_id', session.id)
          .order('display_order', { ascending: true }),
        supabase
          .from('documents')
          .select('*')
          .eq('session_id', session.id),
      ])
      sessionTests = st || []
      if ((sessionDocs || []).length > 0) documents = sessionDocs as any[]
    }

    let patientContext = `DATOS DEL PACIENTE:
- Nombre: ${patient.full_name}
- Fecha de nacimiento: ${patient.date_of_birth || 'No especificada'}
- Sexo: ${patient.gender === 'male' ? 'Hombre' : patient.gender === 'female' ? 'Mujer' : 'No especificado'}
`

    if (anamnesis?.form_data) {
      const fd = anamnesis.form_data
      // Filter out verification metadata keys
      const anamnesisData = Object.entries(fd)
        .filter(([key]) => !key.startsWith('_')) // metadatos internos (_verified_, _notes_, _rep_, _is_minor…)
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

    if (clinicalData && Object.keys(clinicalData).length > 0) {
      const assessmentEntries = Object.entries(clinicalData)
        .filter(([key]) => !key.startsWith('_')) // descartar meta (_regions, _region)
        .map(([key, value]) => `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join('\n')
      if (assessmentEntries) {
        patientContext += `\n\nDATOS DE LA EXPLORACIÓN FÍSICA / VALORACIÓN:\n${assessmentEntries}`
      }
    }

    // Anotaciones generales del fisioterapeuta (sessions.notes) — se incluyen SIEMPRE que
    // existan, aunque no haya exploración (p. ej. sesiones de equipo, sin exploración).
    if (clinicalNotes && String(clinicalNotes).trim()) {
      patientContext += `\n\nANOTACIONES GENERALES DEL FISIOTERAPEUTA:\n${clinicalNotes}`
    }

    // Fase F: pruebas de la sesión — notas por prueba + guía de interpretación VALD por prueba.
    if (sessionTests.length > 0) {
      const testsBlock = sessionTests
        .map((t: any) => {
          const parts: string[] = [`- ${t.test_name}${t.status ? ` (${t.status})` : ''}`]
          if (t.notes && String(t.notes).trim()) parts.push(`    Notas del fisio: ${t.notes}`)
          const prompt = t.tests?.vald_interpretation_prompt
          if (prompt && String(prompt).trim()) parts.push(`    Guía de interpretación VALD: ${prompt}`)
          return parts.join('\n')
        })
        .join('\n')
      patientContext += `\n\nPRUEBAS FÍSICAS DE LA SESIÓN (con notas del fisio y guía de interpretación por prueba):\n${testsBlock}`
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

    // Adjuntar a Claude los documentos de la sesión (PDF de VALD + imágenes clínicas) para que
    // LEA e interprete los resultados objetivos. Requiere service_role para descargar del bucket
    // privado. Si falta la key o falla la descarga, se cae a solo-texto (comportamiento anterior).
    const docBlocks: any[] = []
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey && (documents as any[]).length > 0) {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      // Priorizar informes VALD (PDF) e imágenes; cap de 6 adjuntos para acotar coste/tamaño.
      const toSend = (documents as any[]).filter((d) => d.storage_path).slice(0, 6)
      for (const d of toSend) {
        try {
          const { data: blob, error } = await admin.storage.from('documents').download(d.storage_path)
          if (error || !blob) continue
          const buf = Buffer.from(await blob.arrayBuffer())
          if (buf.length > 20 * 1024 * 1024) continue // saltar > 20MB
          const b64 = buf.toString('base64')
          const name = String(d.file_name || '').toLowerCase()
          if (name.endsWith('.pdf')) {
            docBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 }, title: d.file_name || 'documento' })
          } else if (/\.(png|jpe?g|webp|gif)$/.test(name)) {
            const media = name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : name.endsWith('.gif') ? 'image/gif' : 'image/jpeg'
            docBlocks.push({ type: 'image', source: { type: 'base64', media_type: media, data: b64 } })
          }
        } catch (e) {
          // no fatal: seguimos sin ese adjunto
        }
      }
    }

    const userText = docBlocks.length > 0
      ? `Genera el informe de Valoración Integral Avanzada PODIUM para este paciente. Se adjuntan ${docBlocks.length} documento(s) (informes/gráficas de VALD y/o imágenes clínicas): LÉELOS e interpreta sus resultados objetivos según las reglas. Responde SOLO con JSON válido.\n\n${patientContext}`
      : `Genera el informe de Valoración Integral Avanzada PODIUM para este paciente. Responde SOLO con JSON válido.\n\n${patientContext}`

    // Call Claude
    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [...docBlocks, { type: 'text', text: userText }] as any,
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
        session_id: session?.id || null,
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

    // Fire-and-forget: auto-classify patient using the new report as richest context.
    // Skipped if patient already has a manual classification.
    try {
      const origin = request.nextUrl.origin
      fetch(`${origin}/api/patients/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ patientId }),
      }).catch((e) => console.error('Auto-classify trigger failed:', e))
    } catch (e) {
      // non-blocking
    }

    return NextResponse.json({ report })
  } catch (error: any) {
    console.error('Report generation error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
