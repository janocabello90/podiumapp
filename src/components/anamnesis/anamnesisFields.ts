// ============================================
// Anamnesis Form Field Definitions
// Based on Podium Anamnesis Spec (94 fields)
// ============================================

export interface AnamnesisField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'select' | 'multiselect' | 'scale' | 'boolean' | 'date'
  placeholder?: string
  description?: string
  options?: string[]
  required?: boolean
  condition?: (data: Record<string, any>) => boolean
}

export interface AnamnesisBlock {
  id: string
  title: string
  description: string
  fields: AnamnesisField[]
}

export const ANAMNESIS_BLOCKS: AnamnesisBlock[] = [
  // ============================================
  // BLOCK 1: Datos personales y estilo de vida
  // ============================================
  {
    id: 'personal',
    title: 'Datos personales',
    description: 'Empecemos con algunos datos básicos',
    fields: [
      {
        key: 'occupation',
        label: '¿A qué te dedicas?',
        type: 'text',
        placeholder: 'Ej: Oficinista, albañil, deportista profesional...',
        description: 'Tu trabajo nos ayuda a entender las demandas físicas de tu día a día',
      },
      {
        key: 'work_hours',
        label: '¿Cuántas horas trabajas al día?',
        type: 'select',
        options: ['Menos de 4h', '4-6h', '6-8h', '8-10h', 'Más de 10h'],
      },
      {
        key: 'work_posture',
        label: '¿Tu trabajo es principalmente...?',
        type: 'select',
        options: ['Sentado', 'De pie', 'Mixto (sentado y de pie)', 'En movimiento constante', 'Carga de peso'],
      },
      {
        key: 'physical_activity',
        label: '¿Realizas actividad física regular?',
        type: 'boolean',
      },
      {
        key: 'activity_type',
        label: '¿Qué actividad física realizas?',
        type: 'text',
        placeholder: 'Ej: Correr, pádel, gym, natación...',
        condition: (data) => data.physical_activity === true,
      },
      {
        key: 'activity_frequency',
        label: '¿Con qué frecuencia?',
        type: 'select',
        options: ['1-2 veces/semana', '3-4 veces/semana', '5+ veces/semana', 'Diario'],
        condition: (data) => data.physical_activity === true,
      },
      {
        key: 'activity_intensity',
        label: '¿A qué intensidad?',
        type: 'select',
        options: ['Baja (pasear, yoga suave)', 'Moderada (trotar, bici tranquila)', 'Alta (running, crossfit, competición)'],
        condition: (data) => data.physical_activity === true,
      },
      {
        key: 'sleep_hours',
        label: '¿Cuántas horas duermes de media?',
        type: 'select',
        options: ['Menos de 5h', '5-6h', '6-7h', '7-8h', 'Más de 8h'],
      },
      {
        key: 'sleep_quality',
        label: '¿Cómo es la calidad de tu sueño?',
        type: 'select',
        options: ['Muy mala', 'Mala', 'Regular', 'Buena', 'Muy buena'],
      },
      {
        key: 'stress_level',
        label: '¿Cuál es tu nivel de estrés actual?',
        type: 'scale',
        description: 'Del 0 (nada) al 10 (máximo)',
      },
      {
        key: 'nutrition_quality',
        label: '¿Cómo valorarías tu alimentación?',
        type: 'select',
        options: ['Muy desequilibrada', 'Mejorable', 'Aceptable', 'Buena', 'Muy saludable'],
      },
      {
        key: 'hydration',
        label: '¿Cuánta agua bebes al día aproximadamente?',
        type: 'select',
        options: ['Menos de 1 litro', '1-1.5 litros', '1.5-2 litros', 'Más de 2 litros'],
      },
      {
        key: 'smoking',
        label: '¿Fumas?',
        type: 'select',
        options: ['No', 'Sí, ocasionalmente', 'Sí, a diario', 'Exfumador/a'],
      },
      {
        key: 'alcohol',
        label: '¿Consumes alcohol?',
        type: 'select',
        options: ['No', 'Ocasionalmente (social)', 'Regularmente (varias veces/semana)', 'A diario'],
      },
    ],
  },

  // ============================================
  // BLOCK 2: Motivo de consulta y dolor
  // ============================================
  {
    id: 'consultation',
    title: 'Motivo de consulta',
    description: 'Cuéntanos por qué vienes',
    fields: [
      {
        key: 'main_reason',
        label: '¿Cuál es el motivo principal de tu consulta?',
        type: 'textarea',
        placeholder: 'Describe con tus palabras qué te ocurre...',
        description: 'Cuéntanos con tus propias palabras. No te preocupes por usar términos médicos.',
      },
      {
        key: 'pain_location',
        label: '¿Dónde sientes el dolor o molestia?',
        type: 'text',
        placeholder: 'Ej: Rodilla derecha, zona lumbar, hombro izquierdo...',
      },
      {
        key: 'pain_side',
        label: '¿Es en un lado concreto?',
        type: 'select',
        options: ['Derecho', 'Izquierdo', 'Ambos lados', 'Central / No aplica'],
      },
      {
        key: 'pain_intensity_now',
        label: '¿Cuánto dolor sientes ahora mismo?',
        type: 'scale',
        description: 'Del 0 (nada) al 10 (el peor dolor imaginable)',
      },
      {
        key: 'pain_intensity_max',
        label: '¿Cuál es el máximo de dolor que has sentido?',
        type: 'scale',
        description: 'Del 0 al 10, el peor momento',
      },
      {
        key: 'pain_type',
        label: '¿Cómo describirías el dolor?',
        type: 'multiselect',
        options: ['Agudo / punzante', 'Sordo / molesto', 'Quemazón', 'Hormigueo / eléctrico', 'Presión / peso', 'Palpitante', 'Rigidez', 'Otro'],
      },
      {
        key: 'pain_pattern',
        label: '¿Cuándo aparece el dolor?',
        type: 'multiselect',
        options: ['Constante', 'Al moverme', 'En reposo', 'Por la mañana', 'Por la noche', 'Después de esfuerzo', 'Variable'],
      },
      {
        key: 'pain_aggravates',
        label: '¿Qué empeora el dolor?',
        type: 'textarea',
        placeholder: 'Ej: Estar sentado mucho rato, subir escaleras, girar...',
      },
      {
        key: 'pain_relieves',
        label: '¿Qué alivia el dolor?',
        type: 'textarea',
        placeholder: 'Ej: Descansar, calor, analgésicos, estiramientos...',
      },
    ],
  },

  // ============================================
  // BLOCK 3: Historia del problema
  // ============================================
  {
    id: 'history',
    title: 'Historia del problema',
    description: 'Cuéntanos cómo empezó',
    fields: [
      {
        key: 'onset',
        label: '¿Cómo empezó?',
        type: 'select',
        options: ['De golpe (traumático)', 'Fue apareciendo poco a poco', 'Después de un esfuerzo', 'Sin motivo aparente', 'Tras una cirugía', 'Otro'],
      },
      {
        key: 'onset_date',
        label: '¿Cuándo empezó?',
        type: 'text',
        placeholder: 'Ej: Hace 2 semanas, en enero 2024, hace 3 años...',
      },
      {
        key: 'onset_detail',
        label: '¿Puedes describir cómo ocurrió?',
        type: 'textarea',
        placeholder: 'Cuéntanos la situación en la que empezaste a notar la molestia...',
        condition: (data) => data.onset === 'De golpe (traumático)' || data.onset === 'Después de un esfuerzo',
      },
      {
        key: 'evolution',
        label: '¿Cómo ha evolucionado desde entonces?',
        type: 'select',
        options: ['Está mejor', 'Sigue igual', 'Está peor', 'Va y viene (episodios)'],
      },
      {
        key: 'previous_episodes',
        label: '¿Has tenido episodios similares antes?',
        type: 'boolean',
      },
      {
        key: 'previous_episodes_detail',
        label: '¿Cuántas veces y cuándo?',
        type: 'textarea',
        placeholder: 'Describe brevemente los episodios anteriores...',
        condition: (data) => data.previous_episodes === true,
      },
      {
        key: 'previous_treatments',
        label: '¿Has recibido tratamiento previo para este problema?',
        type: 'multiselect',
        options: ['Fisioterapia', 'Medicación', 'Inyecciones / infiltraciones', 'Cirugía', 'Osteopatía', 'Acupuntura', 'Nada todavía', 'Otro'],
      },
      {
        key: 'previous_treatments_result',
        label: '¿Cómo fue el resultado de esos tratamientos?',
        type: 'textarea',
        placeholder: 'Cuéntanos si te ayudaron, si volvió el problema...',
        condition: (data) => data.previous_treatments && !data.previous_treatments.includes('Nada todavía'),
      },
      {
        key: 'imaging',
        label: '¿Te han hecho pruebas de imagen?',
        type: 'multiselect',
        options: ['Radiografía', 'Ecografía', 'Resonancia magnética', 'TAC / Scanner', 'No me han hecho pruebas'],
      },
      {
        key: 'imaging_findings',
        label: '¿Qué hallazgos hubo? (si los recuerdas)',
        type: 'textarea',
        placeholder: 'Ej: Hernia discal L5-S1, rotura parcial del manguito...',
        condition: (data) => data.imaging && !data.imaging.includes('No me han hecho pruebas'),
      },
    ],
  },

  // ============================================
  // BLOCK 4: Red flags (banderas rojas)
  // ============================================
  {
    id: 'red_flags',
    title: 'Señales de alerta',
    description: 'Unas preguntas importantes para tu seguridad',
    fields: [
      {
        key: 'unexplained_weight_loss',
        label: '¿Has perdido peso de forma inexplicable recientemente?',
        type: 'boolean',
      },
      {
        key: 'fever',
        label: '¿Has tenido fiebre sin motivo aparente?',
        type: 'boolean',
      },
      {
        key: 'night_pain',
        label: '¿El dolor te despierta por la noche?',
        type: 'boolean',
      },
      {
        key: 'bladder_bowel',
        label: '¿Has notado cambios en el control de vejiga o intestino?',
        type: 'boolean',
        description: 'Pérdida de control, incontinencia, retención...',
      },
      {
        key: 'numbness_weakness',
        label: '¿Tienes adormecimiento o debilidad progresiva en extremidades?',
        type: 'boolean',
      },
      {
        key: 'cancer_history',
        label: '¿Tienes antecedentes de cáncer?',
        type: 'boolean',
      },
      {
        key: 'trauma_recent',
        label: '¿Has sufrido un traumatismo fuerte recientemente?',
        type: 'boolean',
        description: 'Caída importante, accidente de tráfico, golpe fuerte...',
      },
    ],
  },

  // ============================================
  // BLOCK 5: Limitaciones y vida diaria
  // ============================================
  {
    id: 'limitations',
    title: 'Tu día a día',
    description: 'Cómo afecta el problema a tu vida',
    fields: [
      {
        key: 'functional_limitation',
        label: '¿Qué actividades no puedes hacer o te cuestan por este problema?',
        type: 'textarea',
        placeholder: 'Ej: No puedo correr, me cuesta agacharme, no puedo dormir del lado derecho...',
      },
      {
        key: 'daily_impact',
        label: '¿Cuánto afecta a tu vida diaria?',
        type: 'scale',
        description: 'Del 0 (nada) al 10 (me impide hacer vida normal)',
      },
      {
        key: 'work_impact',
        label: '¿Afecta a tu trabajo?',
        type: 'select',
        options: ['No afecta', 'Algo, pero puedo trabajar', 'Bastante, necesito adaptaciones', 'Estoy de baja laboral'],
      },
      {
        key: 'sport_impact',
        label: '¿Afecta a tu deporte o actividad física?',
        type: 'select',
        options: ['No hago deporte', 'No afecta', 'He tenido que reducir', 'He tenido que parar del todo'],
      },
      {
        key: 'sleep_impact',
        label: '¿Afecta a tu sueño?',
        type: 'select',
        options: ['No afecta', 'Algo, tardo más en dormirme', 'Me despierto por el dolor', 'Duermo muy mal por el dolor'],
      },
    ],
  },

  // ============================================
  // BLOCK 6: Historial médico general
  // ============================================
  {
    id: 'medical_history',
    title: 'Historial médico',
    description: 'Tu salud en general',
    fields: [
      {
        key: 'medical_conditions',
        label: '¿Tienes alguna enfermedad o condición diagnosticada?',
        type: 'multiselect',
        options: [
          'Hipertensión',
          'Diabetes',
          'Asma / problemas respiratorios',
          'Enfermedades cardíacas',
          'Artritis / artrosis',
          'Osteoporosis',
          'Fibromialgia',
          'Hipotiroidismo / hipertiroidismo',
          'Depresión / ansiedad',
          'Ninguna',
          'Otra',
        ],
      },
      {
        key: 'medical_conditions_other',
        label: '¿Cuál?',
        type: 'text',
        placeholder: 'Especifica...',
        condition: (data) => data.medical_conditions?.includes('Otra'),
      },
      {
        key: 'surgeries',
        label: '¿Te han operado alguna vez?',
        type: 'boolean',
      },
      {
        key: 'surgeries_detail',
        label: '¿De qué y cuándo?',
        type: 'textarea',
        placeholder: 'Ej: Artroscopia de rodilla (2020), apendicitis (2015)...',
        condition: (data) => data.surgeries === true,
      },
      {
        key: 'implants_prosthetics',
        label: '¿Tienes implantes, prótesis o material de osteosíntesis?',
        type: 'boolean',
        description: 'Placas, tornillos, prótesis de cadera/rodilla...',
      },
      {
        key: 'implants_detail',
        label: '¿Cuáles?',
        type: 'text',
        placeholder: 'Ej: Prótesis de cadera derecha, placa en clavícula...',
        condition: (data) => data.implants_prosthetics === true,
      },
      {
        key: 'medications',
        label: '¿Tomas alguna medicación actualmente?',
        type: 'boolean',
      },
      {
        key: 'medications_detail',
        label: '¿Cuáles?',
        type: 'textarea',
        placeholder: 'Nombre y para qué lo tomas...',
        condition: (data) => data.medications === true,
      },
      {
        key: 'allergies',
        label: '¿Tienes alguna alergia?',
        type: 'boolean',
      },
      {
        key: 'allergies_detail',
        label: '¿A qué?',
        type: 'text',
        placeholder: 'Ej: Penicilina, látex, ibuprofeno...',
        condition: (data) => data.allergies === true,
      },
      {
        key: 'pregnancy',
        label: '¿Estás embarazada o en período de lactancia?',
        type: 'select',
        options: ['No', 'Embarazada', 'Lactancia', 'No aplica'],
      },
      {
        key: 'family_history',
        label: '¿Hay enfermedades relevantes en tu familia?',
        type: 'textarea',
        placeholder: 'Ej: Padre con diabetes, madre con artritis reumatoide...',
        description: 'Padres, hermanos, abuelos...',
      },
    ],
  },

  // ============================================
  // BLOCK 7: Emociones, motivación y expectativas
  // ============================================
  {
    id: 'emotions',
    title: 'Cómo te sientes',
    description: 'Tu estado emocional es importante para nosotros',
    fields: [
      {
        key: 'emotional_state',
        label: '¿Cómo te sientes emocionalmente respecto a este problema?',
        type: 'multiselect',
        options: ['Tranquilo/a', 'Preocupado/a', 'Frustrado/a', 'Ansioso/a', 'Triste', 'Enfadado/a', 'Esperanzado/a', 'Confundido/a'],
      },
      {
        key: 'fear_avoidance',
        label: '¿Evitas movimientos o actividades por miedo a empeorar?',
        type: 'select',
        options: ['No, hago vida normal', 'Algo, evito algunas cosas', 'Bastante, evito muchas actividades', 'Sí, evito casi todo por miedo'],
      },
      {
        key: 'beliefs',
        label: '¿Qué crees que te pasa?',
        type: 'textarea',
        placeholder: 'Cuéntanos qué piensas sobre tu problema, aunque no estés seguro/a...',
        description: 'No hay respuesta incorrecta. Queremos entender tu perspectiva.',
      },
      {
        key: 'expectations',
        label: '¿Qué esperas conseguir con el tratamiento?',
        type: 'textarea',
        placeholder: 'Ej: Volver a correr sin dolor, poder trabajar sin molestias...',
      },
      {
        key: 'goals',
        label: '¿Cuál es tu objetivo principal?',
        type: 'textarea',
        placeholder: 'Si pudieras pedir un deseo para tu salud, ¿cuál sería?',
      },
      {
        key: 'motivation_level',
        label: '¿Cómo de motivado/a estás para comprometerte con el tratamiento?',
        type: 'scale',
        description: 'Del 0 (nada) al 10 (totalmente comprometido/a)',
      },
    ],
  },

  // ============================================
  // BLOCK 8: Disposición y programa (sales)
  // ============================================
  {
    id: 'disposition',
    title: 'Para terminar',
    description: 'Un par de preguntas más y habremos acabado',
    fields: [
      {
        key: 'how_found_us',
        label: '¿Cómo nos has conocido?',
        type: 'select',
        options: ['Recomendación de un conocido', 'Google / búsqueda online', 'Instagram', 'Otro profesional sanitario', 'Otro'],
      },
      {
        key: 'previous_physio',
        label: '¿Has ido antes a un fisioterapeuta por este problema?',
        type: 'boolean',
      },
      {
        key: 'previous_physio_experience',
        label: '¿Cómo fue tu experiencia?',
        type: 'textarea',
        placeholder: 'Cuéntanos brevemente...',
        condition: (data) => data.previous_physio === true,
      },
      {
        key: 'commitment_availability',
        label: '¿Cuántas sesiones a la semana podrías asistir?',
        type: 'select',
        options: ['1 sesión/semana', '2 sesiones/semana', '3 o más sesiones/semana', 'Según necesidad'],
      },
      {
        key: 'additional_info',
        label: '¿Hay algo más que quieras contarnos?',
        type: 'textarea',
        placeholder: 'Cualquier información que consideres relevante...',
        description: 'Este es tu espacio. Si hay algo que no te hemos preguntado y crees importante, cuéntanoslo aquí.',
      },
    ],
  },
]
