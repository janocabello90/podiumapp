import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getReportInstructions } from '@/lib/reports/prompt'
import { PATIENT_TOKEN, redactPatientName, restorePatientName } from '@/lib/reports/redact'
import { DESCARGO_INDIVIDUAL, DESCARGO_TEAM } from '@/lib/reports/descargo'
import { buildReferencesContext } from '@/lib/reports/references'
import { parseMetricsSchema, buildMetricsInstruction, metricsByTestName } from '@/lib/reports/metrics'
import { parseReportJson } from '@/lib/reports/parseReportJson'
import { REPORT_MODEL, REPORT_MAX_TOKENS, REPORT_THINKING, REPORT_EFFORT } from '@/lib/reports/aiConfig'
import { runReportInBackground, activeSince } from '@/lib/reports/background'

// Generación en SEGUNDO PLANO: el trabajo pesado corre tras responder (waitUntil), hasta este tope.
export const maxDuration = 800

// ESTRUCTURA FIJA del informe individual (el rol/instrucciones editables se anteponen).
const STRUCTURE_INDIVIDUAL = `ESTRUCTURA DEL INFORME que debes generar (en formato JSON con las secciones):

1. "portada_intro": Texto introductorio para la portada. Explica que el informe recoge la información de la Valoración Integral Avanzada PODIUM. Menciona la metodología propia de PODIUM (entender qué está limitando la capacidad, no solo identificar una lesión). Incluye que a lo largo del informe encontrará: resumen de anamnesis, hallazgos de exploración, resultados objetivos, explicación integrada y recomendación de itinerario. Termina con el compromiso de acompañar con criterio clínico, claridad y planificación coherente. Adapta el texto al caso concreto del paciente.

2. "resumen_anamnesis": Resumen narrativo en 2-3 párrafos de la anamnesis. Describe el motivo de consulta, la cronología, los síntomas, el contexto laboral/personal, tratamientos previos, y el enfoque de la valoración. Redacta en tercera persona refiriéndote a la persona como «[[PACIENTE]]» (marcador que se sustituye por el nombre al emitir el informe).

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

(El "descargo" de responsabilidad NO lo generes: es un texto legal fijo que añade el sistema automáticamente. Omítelo del JSON.)

REGLAS:
- Escribe en español profesional clínico, pero comprensible para el paciente.
- Usa párrafos narrativos, NO bullet points (excepto en la portada donde se listan los contenidos del informe).
- Refiérete a la persona SIEMPRE como «[[PACIENTE]]» (marcador que se sustituye por el nombre al emitir el informe); no inventes un nombre.
- NO inventes datos que no estén en la información proporcionada.
- COHERENCIA DE DATOS: no introduzcas contradicciones internas; las cifras y los datos deben ser coherentes entre todas las secciones. Para los datos demográficos (edad, sexo, fecha de nacimiento) usa EXCLUSIVAMENTE los de DATOS DEL PACIENTE aportados; si un documento adjunto (p. ej. una gráfica de VALD) muestra un dato distinto, PREVALECE la ficha. No reafirmes una edad ni una fecha distintas de las aportadas.
- Si no hay datos de alguna sección de exploración, indica que no se han registrado hallazgos en esa área.
- Las hipótesis diagnósticas siempre con "posible", "compatible con" o "sugiere".
- El tono es cercano pero riguroso, como un profesional que explica al paciente su situación.
- Si se adjuntan documentos a este mensaje (informes/gráficas de VALD, ecografías, imágenes clínicas), LÉELOS e interpreta sus RESULTADOS OBJETIVOS: valores por lado (izq/der), asimetrías (%), potencia/fuerza, percentiles y hallazgos de imagen. Integra esos datos y su interpretación (cruzándolos con las notas del fisio y la guía de interpretación de cada prueba) en "exploracion_fisica.fuerza"/"hallazgos" y, sobre todo, en "conclusiones". No te limites a mencionar que existen: interpreta lo que muestran.
- NOTAS DEL FISIO: intégralas REDACTADAS como interpretación clínica dentro del texto; NO las cites entrecomilladas ni las reproduzcas literalmente (nada de «bien, sin problema»).
- COHERENCIA ANATÓMICA (¡importante!): no confundas regiones. «Tren superior» = hombro, codo, muñeca y columna dorsal; «tren inferior» = cadera, rodilla y tobillo. No atribuyas a una región hallazgos que pertenecen a otra; revisa CADA afirmación de "conclusiones" antes de cerrarla (p. ej., no cierres un párrafo sobre rodilla/cadera hablando de "tren superior").
- CIFRAS CON MODERACIÓN: no satures el texto de números entre paréntesis. Conserva solo las cifras CLAVE (asimetrías y percentiles de lo prioritario); el resto de valores quedan consultables en el PDF de VALD y no hace falta repetirlos.
- SÍNTESIS: redacta de forma directa y sintética, sin perder rigor clínico; evita relleno, rodeos y frases redundantes.
- CADA APARTADO EN SU SITIO: en "exploracion_fisica.hallazgos" describe SOLO hallazgos de la exploración (sin conclusiones ni plan terapéutico, que van en "conclusiones"); no repitas la misma información entre secciones.
- Responde SOLO con el JSON válido, sin texto adicional.`

// Informe de EQUIPO / deportista — "Informe de Rendimiento y Prevención" (Metodología Podium®).
// Estructura distinta del individual: sin exploración física ni pruebas de imagen; foco en
// valoración funcional (VALD), semáforo, conclusiones, recomendaciones y resumen ejecutivo.
// ESTRUCTURA FIJA del informe de equipo (el rol/instrucciones editables se anteponen).
const STRUCTURE_TEAM = `Se te adjuntan (si existen) los informes/gráficas de VALD en PDF y/o imágenes: LÉELOS e interpreta sus resultados objetivos (valores por lado izq/der, asimetrías %, potencia W/kg, fuerza N, percentiles, control postural). Cruza esos datos con las notas del fisio por prueba y su guía de interpretación.

Genera SOLO un JSON válido con esta estructura:

{
  "objetivo_intro": "Texto introductorio de portada en TRES párrafos separados por una línea en blanco (usa '\\n\\n' entre párrafos; NO uses viñetas ni guiones, redacta en prosa). Párrafo 1 (objetivo y metodología): el informe recoge los resultados de la Valoración Funcional (Metodología Podium®), un protocolo para analizar de forma objetiva el estado funcional del deportista e identificar los factores que influyen en su rendimiento, su tolerancia a la carga de entrenamiento y competición, y su riesgo de lesión; integra el análisis del movimiento y la medición objetiva mediante tecnología VALD de movilidad, fuerza, potencia, control motor y capacidad neuromuscular, adaptada a las demandas de su deporte y puesto. Párrafo 2 (contenido del informe, en prosa fluida, NO lista): enumera en una frase qué encontrará el lector — perfil del deportista, anamnesis deportiva, valoración funcional interpretada por áreas, hallazgos principales, conclusiones y recomendaciones para el cuerpo técnico. Párrafo 3 (cierre técnico): el objetivo no es acumular datos sino convertir la información en decisiones útiles de rendimiento y prevención —qué capacidades priorizar y qué aspectos monitorizar—; los resultados son una fotografía funcional del momento que adquiere su valor al integrarse con la evolución del entrenamiento, la competición y las valoraciones sucesivas. Tono técnico dirigido al cuerpo técnico.",
  "resumen_anamnesis": "Resumen narrativo (1-2 párrafos) de la anamnesis deportiva: historial de lesiones, molestias actuales, carga de entrenamiento/competición, sueño/recuperación/fatiga, objetivos de temporada y factores que puedan condicionar el rendimiento. Usa solo los datos disponibles.",
  "valoracion_funcional": {
    "introduccion": "Párrafo introductorio: se ha aplicado una batería de pruebas adaptada a las demandas del deporte; el análisis del movimiento, movilidad, fuerza, potencia, capacidad reactiva y asimetrías ofrece una radiografía funcional del deportista.",
    "calidad_movimiento": "Interpretación del patrón de movimiento y control motor (a partir de datos y notas).",
    "movilidad": "Interpretación de la movilidad relevante para el deporte.",
    "fuerza": "Interpretación de la producción de fuerza, simetrías y ratios (con valores concretos si están en las gráficas).",
    "potencia": "Interpretación de la producción de potencia y rendimiento en salto (con valores/percentiles si están).",
    "capacidad_reactiva": "Interpretación de la eficiencia del ciclo estiramiento-acortamiento y capacidad reactiva."
  },
  "hallazgos": "Resumen de los déficits y fortalezas con mayor impacto sobre el rendimiento y la prevención (2 párrafos).",
  "conclusiones": "Síntesis final integrada (2-3 párrafos): interpreta en conjunto cómo se mueve el deportista, cómo produce fuerza y cómo absorbe/genera carga, y CIERRA integrando en la prosa —sin epígrafes ni listas— sus principales fortalezas, los aspectos a mejorar, el nivel y las áreas de riesgo funcional, y el objetivo principal de trabajo para la temporada. Es el apartado que resume el informe: no repitas literalmente los hallazgos, intégralos.",
  "recomendaciones": {
    "capacidades_prioritarias": "Capacidades prioritarias a desarrollar.",
    "aspectos_monitorizar": "Aspectos a monitorizar.",
    "cuerpo_tecnico": "Recomendaciones para el cuerpo técnico.",
    "siguiente_valoracion": "Momento recomendado para la siguiente valoración funcional."
  }
}

(El "descargo" de responsabilidad NO lo incluyas: es un texto legal fijo que añade el sistema automáticamente.)

REGLAS:
- Español profesional; párrafos narrativos.
- NO inventes valores: usa los que leas de las gráficas de VALD o las notas; si no hay, interpreta cualitativamente sin cifras.
- PERCENTILES Y MAGNITUDES (¡cuidado!): una misma prueba puede mostrar VARIOS percentiles, uno por métrica (RSI, altura de salto, tiempo de vuelo, tiempo de contacto, impulso, fuerza…). Asigna cada percentil SOLO a la métrica a la que pertenece; NUNCA lo traslades de una métrica a otra. Interpreta la magnitud correctamente: un percentil por debajo de ~40 es bajo, en torno a 50 es medio, y por encima de ~60 es medio-alto; NO describas como "bajo" un valor que esté en la media o por encima. Verifica lado (izquierda/derecha) y unidades antes de afirmar. Si no estás seguro de una cifra leída en una gráfica, descríbela de forma cualitativa en vez de arriesgar un número equivocado.
- COHERENCIA DE DATOS: no introduzcas contradicciones internas; las cifras y los datos deben ser coherentes entre todas las secciones. Para los datos demográficos (edad, sexo, deporte, posición, equipo, lateralidad) usa EXCLUSIVAMENTE los del PERFIL DEL DEPORTISTA / DATOS DEL PACIENTE aportados; si un documento adjunto (p. ej. una gráfica de VALD) muestra un dato distinto, PREVALECE la ficha. No reafirmes una edad ni una fecha de nacimiento distintas de las aportadas.
- Refiérete al deportista SIEMPRE como «[[PACIENTE]]» (marcador que se sustituye por el nombre al emitir el informe); no inventes un nombre.
- NOTAS DEL FISIO: intégralas REDACTADAS dentro del texto como interpretación clínica; NO las cites entrecomilladas ni las reproduzcas literalmente (nada de «bien, sin problema»). Conviértelas en frases propias del informe.
- COHERENCIA ANATÓMICA (¡importante!): no confundas regiones. «Tren superior» = hombro, codo, muñeca y columna dorsal; «tren inferior» = cadera, rodilla y tobillo. No atribuyas a una región hallazgos que pertenecen a otra; revisa CADA afirmación de "conclusiones" antes de cerrarla (p. ej., no cierres un párrafo sobre rodilla/cadera hablando de "tren superior").
- CIFRAS CON MODERACIÓN: no satures el texto de números entre paréntesis. Conserva solo las cifras CLAVE (asimetrías y percentiles de lo prioritario); el resto de valores quedan consultables en el PDF de VALD y no hace falta repetirlos en el texto.
- SÍNTESIS: redacta de forma directa y sintética, sin perder rigor clínico. Evita relleno, rodeos y frases redundantes; menos texto y más concreto.
- CADA APARTADO EN SU SITIO: en "hallazgos" describe SOLO déficits y fortalezas (sin recomendaciones ni conclusiones); las recomendaciones van solo en "recomendaciones"; no repitas la misma información entre "hallazgos", "conclusiones" y "recomendaciones".
- Responde SOLO con el JSON válido, sin texto adicional.`

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null
  const d = new Date(dob); if (isNaN(d.getTime())) return null
  const now = new Date(); let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

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

    const { patientId, sessionId, referenceIds } = await request.json()
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

    // Candado de concurrencia: no duplicar el informe de esta sesión si ya hay uno en curso.
    if (session?.id) {
      const { data: inFlight } = await supabase
        .from('reports').select('id')
        .eq('session_id', session.id).eq('status', 'generating')
        .gte('created_at', activeSince()).limit(1).maybeSingle()
      if (inFlight) return NextResponse.json({ error: 'Ya se está generando un informe para esta sesión' }, { status: 409 })
    }

    // Fila en 'generating' (coherente: individual ⇒ patient_id + session_id). Se responde 202 y el
    // trabajo pesado (contexto + IA + guardado) va por detrás con waitUntil: el cliente puede cerrar.
    const { data: pending, error: pendingErr } = await supabase
      .from('reports')
      .insert({
        patient_id: patientId,
        clinic_id: patient.clinic_id,
        generated_by: user.id,
        status: 'generating',
        session_id: session?.id || null,
        anamnesis_id: anamnesis?.id || null,
        assessment_id: assessment?.id || null,
      })
      .select('id')
      .single()
    if (pendingErr || !pending) {
      return NextResponse.json({ error: 'No se pudo iniciar la generación' }, { status: 500 })
    }
    const reportId = pending.id

    runReportInBackground(reportId, async () => {
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
          .select('id, test_id, test_name, notes, status, display_order, tests(vald_interpretation_prompt, result_schema)')
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

    // ¿Informe de EQUIPO (Rendimiento y Prevención)? Se decide por si la sesión pertenece a un
    // estudio (campaign_id), igual que el patrón de la consulta. Si no, informe individual clásico.
    const isTeamReport = !!(session && (session as any).campaign_id)
    let teamPerfil: any = null
    if (isTeamReport) {
      const fd = (anamnesis?.form_data as any) || {}
      let teamName: string | null = null
      let teamCategory: string | null = null
      if ((patient as any).team_id) {
        const { data: tm } = await supabase.from('teams').select('name, category').eq('id', (patient as any).team_id).single()
        teamName = (tm as any)?.name ?? null
        teamCategory = (tm as any)?.category ?? null
      }
      let sportName: string | null = null
      const sportId = (session as any)?.sport_id ?? (patient as any).sport_id
      if (sportId) {
        const { data: sp } = await supabase.from('sports').select('name').eq('id', sportId).single()
        sportName = (sp as any)?.name ?? null
      }
      // Estudio (campaña) al que pertenece la sesión — para la portada del informe.
      let estudioName: string | null = null
      const campaignId = (session as any)?.campaign_id
      if (campaignId) {
        const { data: cmp } = await supabase.from('campaigns').select('name').eq('id', campaignId).single()
        estudioName = (cmp as any)?.name ?? null
      }
      const lateralidad = [fd.dominant_leg ? `Pierna ${fd.dominant_leg}` : null, fd.dominant_arm ? `Brazo ${fd.dominant_arm}` : null].filter(Boolean).join(' · ') || null
      teamPerfil = {
        nombre: patient.full_name,
        edad: ageFromDob(patient.date_of_birth),
        sexo: patient.gender === 'male' ? 'Hombre' : patient.gender === 'female' ? 'Mujer' : (fd.sex || null),
        deporte: sportName,
        posicion: fd.position || null,
        categoria: teamCategory,
        altura_cm: fd.height_cm ?? null,
        peso_kg: fd.weight_kg ?? null,
        lateralidad,
        horas_entreno_semana: fd.training_hours_week ?? null,
        equipo: teamName,
        estudio: estudioName,
      }
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
      patientContext += `\n\n===== ANOTACIONES GENERALES DEL FISIOTERAPEUTA SOBRE LA SESIÓN =====\n(Impresión global, contexto y matices que el profesional considera relevantes.)\n${clinicalNotes}`
    }

    // Pruebas de la sesión — para CADA prueba: guía de interpretación (cómo leerla) + observaciones
    // del fisio. Los valores numéricos de estas pruebas están en las gráficas de VALD adjuntas.
    if (sessionTests.length > 0) {
      const testsBlock = sessionTests
        .map((t: any, i: number) => {
          const parts: string[] = [`${i + 1}) PRUEBA: ${t.test_name}${t.status ? ` — estado: ${t.status}` : ''}`]
          const prompt = t.tests?.vald_interpretation_prompt
          parts.push(`   · Cómo interpretarla (guía de la clínica): ${prompt && String(prompt).trim() ? String(prompt).trim() : '(sin guía específica)'}`)
          parts.push(`   · Observaciones del fisioterapeuta: ${t.notes && String(t.notes).trim() ? String(t.notes).trim() : '(sin observaciones)'}`)
          return parts.join('\n')
        })
        .join('\n\n')
      patientContext += `\n\n===== PRUEBAS REALIZADAS EN LA SESIÓN =====
Los RESULTADOS NUMÉRICOS de estas pruebas están en las GRÁFICAS DE VALD adjuntas a este mensaje (léelas). Para cada prueba tienes su guía de interpretación y las observaciones del fisioterapeuta. Interpreta SIEMPRE cruzando tres fuentes: (1) los valores de la gráfica VALD, (2) la guía de interpretación y (3) las observaciones del fisio.

${testsBlock}`
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

    // Contexto de perfil para el informe de equipo (datos ya estructurados).
    if (isTeamReport && teamPerfil) {
      const p = teamPerfil
      const perfilLines = [
        `- Nombre: ${p.nombre}`,
        p.edad != null ? `- Edad: ${p.edad}` : null,
        p.sexo ? `- Sexo: ${p.sexo}` : null,
        p.deporte ? `- Deporte: ${p.deporte}` : null,
        p.posicion ? `- Posición: ${p.posicion}` : null,
        p.categoria ? `- Categoría: ${p.categoria}` : null,
        p.equipo ? `- Equipo: ${p.equipo}` : null,
        (p.altura_cm || p.peso_kg) ? `- Altura/Peso: ${p.altura_cm ?? '—'} cm / ${p.peso_kg ?? '—'} kg` : null,
        p.lateralidad ? `- Lateralidad: ${p.lateralidad}` : null,
        p.horas_entreno_semana != null ? `- Horas de entrenamiento semanales: ${p.horas_entreno_semana}` : null,
      ].filter(Boolean).join('\n')
      patientContext = `PERFIL DEL DEPORTISTA:\n${perfilLines}\n\n${patientContext}`
    }

    // PRIVACIDAD (protección de datos): la IA NO debe ver el nombre real del paciente.
    // Se sustituye por un marcador en TODO el contexto (datos, anamnesis, notas, exploración…)
    // y se restituye por el nombre real en el resultado, tras la respuesta de la IA.
    patientContext = redactPatientName(patientContext, patient.full_name || '')

    // Referencias / baremos normativos seleccionados por el fisio (se adjuntan como TEXTO).
    let referencesBlock = ''
    if (Array.isArray(referenceIds) && referenceIds.length > 0) {
      const ids = referenceIds.filter((x: any) => typeof x === 'string').slice(0, 5)
      if (ids.length > 0) {
        const { data: refRows } = await supabase
          .from('sport_references')
          .select('name, sex, age_min, age_max, level, phase, season, prompt, body_md')
          .in('id', ids)
          .eq('clinic_id', patient.clinic_id)
        if (refRows && refRows.length > 0) referencesBlock = buildReferencesContext(refRows as any[])
      }
    }

    const informeNombre = isTeamReport ? 'Informe de Rendimiento y Prevención (Metodología Podium®)' : 'Valoración Integral Avanzada PODIUM'
    const guia = `Genera el ${informeNombre} para este ${isTeamReport ? 'deportista' : 'paciente'}.

PRIVACIDAD: por protección de datos NO se te facilita el nombre real. Cuando debas referirte a la persona, usa EXACTAMENTE el marcador «${PATIENT_TOKEN}» (se sustituirá por el nombre al emitir el informe). No inventes un nombre.

CÓMO USAR EL CONTEXTO (viene ordenado a continuación):
- DATOS y ANAMNESIS: quién es y su relato/contexto.${isTeamReport ? '' : '\n- EXPLORACIÓN FÍSICA / VALORACIÓN: hallazgos de la exploración del fisio.'}
- PRUEBAS REALIZADAS: cada prueba trae su GUÍA de interpretación y las OBSERVACIONES del fisio. Sus valores numéricos están en las GRÁFICAS DE VALD ADJUNTAS a este mensaje.
- ANOTACIONES GENERALES DEL FISIO: impresión global y matices; tenlos muy en cuenta.
${docBlocks.length > 0 ? `- DOCUMENTOS ADJUNTOS (${docBlocks.length}): informes/gráficas de VALD y/o imágenes. LÉELOS e interpreta sus resultados objetivos.` : '- (No se han adjuntado documentos; interpreta con las notas y guías disponibles.)'}${referencesBlock ? '\n- REFERENCIAS NORMATIVAS DEL DEPORTE: baremos para contextualizar los valores del jugador (ver al final). Úsalos con criterio y respeta la población que representan.' : ''}

Integra y CRUZA todas estas fuentes; no te limites a listarlas. Responde SOLO con JSON válido.

${patientContext}${referencesBlock ? `\n\n${referencesBlock}` : ''}`

    // Capa de datos objetivos: pedir a la IA que EXTRAIGA las métricas clave de las pruebas que
    // las tengan definidas (tests.result_schema). Si ninguna las tiene, no añade nada al prompt
    // y el individual se genera exactamente igual que antes (aditivo, no rompe lo actual).
    const metricsInstruction = buildMetricsInstruction(
      sessionTests.map((st: any) => ({ test_name: st.test_name, metrics: parseMetricsSchema(st.tests?.result_schema) }))
    )
    const userText = guia + metricsInstruction

    // Rol/instrucciones editables por la clínica (Ajustes → Informes) + estructura fija.
    const reportInstructions = await getReportInstructions(supabase, patient.clinic_id, isTeamReport ? 'team' : 'individual')
    const systemPrompt = `${reportInstructions}\n\n${isTeamReport ? STRUCTURE_TEAM : STRUCTURE_INDIVIDUAL}`

    // Call Claude
    const anthropic = new Anthropic({ apiKey })

    // Streaming: con max_tokens alto (16k) evita timeouts HTTP. finalMessage() devuelve
    // el mensaje completo, con la misma forma que create() (parseo posterior sin cambios).
    const stream = anthropic.messages.stream({
      model: REPORT_MODEL,
      max_tokens: REPORT_MAX_TOKENS,
      thinking: REPORT_THINKING,
      output_config: REPORT_EFFORT,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [...docBlocks, { type: 'text', text: userText }] as any,
        }
      ],
    } as any)
    const message = await stream.finalMessage()

    // Extract text from response
    const responseText = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')

    // Parse JSON (tolerante a preámbulo / valla sin cerrar por truncado). Si falla,
    // guardamos la respuesta CRUDA de la IA + stop_reason en la propia fila, para poder
    // diagnosticar el fallo desde la BD (no solo un mensaje genérico).
    const stopReason = (message as any).stop_reason
    let reportData
    try {
      reportData = parseReportJson(responseText)
    } catch {
      console.error('Failed to parse Claude response. stop_reason=', stopReason, '\n', responseText.substring(0, 800))
      await supabase.from('reports').update({
        status: 'error',
        report_data: {
          _error: stopReason === 'max_tokens'
            ? 'La respuesta de la IA se cortó por longitud (max_tokens). Reinténtalo.'
            : 'No se pudo parsear el JSON de la respuesta de la IA.',
          _stop_reason: stopReason ?? null,
          _raw_response: (responseText || '').slice(0, 24000),
        },
      }).eq('id', reportId)
      return
    }

    // PRIVACIDAD: restituir el nombre real (la IA solo vio el marcador «[[PACIENTE]]»).
    reportData = restorePatientName(reportData, patient.full_name || '')

    // Capa de datos objetivos: persistir las métricas extraídas en session_tests.result_data
    // (marcadas como NO revisadas; el fisio las valida en la pantalla de revisión). No forman
    // parte de la narrativa, así que se quitan del report_data antes de guardar.
    if (reportData && (reportData as any)._metricas) {
      const byName = metricsByTestName((reportData as any)._metricas)
      for (const st of sessionTests as any[]) {
        const valores = byName.get(String(st.test_name).trim())
        if (valores && st.id) {
          await supabase
            .from('session_tests')
            .update({ result_data: { ...valores, _meta: { fuente: 'ia', revisado: false } } })
            .eq('id', st.id)
        }
      }
      delete (reportData as any)._metricas
    }

    // Descargo legal FIJO: lo añade el sistema (no lo genera la IA) → siempre idéntico.
    reportData.descargo = isTeamReport ? DESCARGO_TEAM : DESCARGO_INDIVIDUAL

    // Informe de equipo: marcar plantilla y añadir el perfil (datos estructurados) al report_data.
    if (isTeamReport) {
      reportData = { _template: 'team_performance', perfil: teamPerfil, ...reportData }
    }

    // Guardar el informe terminado: UPDATE de la fila 'generating' creada al inicio.
    const { error: reportError } = await supabase
      .from('reports')
      .update({
        status: 'draft',
        anamnesis_id: anamnesis?.id || null,
        assessment_id: assessment?.id || null,
        report_data: reportData,
        ai_model: REPORT_MODEL,
        ai_prompt_tokens: message.usage?.input_tokens || null,
        ai_completion_tokens: message.usage?.output_tokens || null,
      })
      .eq('id', reportId)

    if (reportError) {
      console.error('Report save error:', reportError)
      throw new Error('Error al guardar el informe')
    }

    // Fire-and-forget: auto-classify patient using the new report as richest context.
    try {
      const origin = request.nextUrl.origin
      fetch(`${origin}/api/patients/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
        body: JSON.stringify({ patientId }),
      }).catch((e) => console.error('Auto-classify trigger failed:', e))
    } catch (e) { /* non-blocking */ }
    })

    return NextResponse.json({ reportId, status: 'generating' }, { status: 202 })
  } catch (error: any) {
    console.error('Report generation error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
