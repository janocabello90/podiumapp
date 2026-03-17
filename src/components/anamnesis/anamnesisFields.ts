// ============================================
// Anamnesis Form Field Definitions
// Quick Anamnesis Express — Post Professional Feedback
// 6 bloques · 30 preguntas · <5 min para el paciente
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
  scaleLabels?: { min: string; max: string }
}

export interface AnamnesisBlock {
  id: string
  title: string
  description: string
  icon?: string
  fields: AnamnesisField[]
  internalNotes?: string[]
}

export const ANAMNESIS_BLOCKS: AnamnesisBlock[] = [
  // ============================================
  // BLOQUE 1 — Sobre ti
  // ============================================
  {
    id: 'about_you',
    title: 'Sobre ti',
    icon: '📋',
    description: 'Cuéntanos un poco sobre ti antes de verte',
    fields: [
      {
        key: 'full_name',
        label: 'Nombre completo',
        type: 'text',
        required: true,
      },
      {
        key: 'birth_date',
        label: 'Fecha de nacimiento',
        type: 'date',
        required: true,
      },
      {
        key: 'occupation',
        label: 'Ocupación actual',
        type: 'text',
        description: 'Esto nos ayuda a entender las cargas de tu día a día',
        required: true,
      },
      {
        key: 'work_demands',
        label: '¿Tu trabajo implica...? (marca todas las que apliquen)',
        type: 'multiselect',
        options: [
          'Esfuerzo físico / carga de pesos',
          'Postura sedentaria prolongada',
          'De pie muchas horas',
          'Movimientos repetitivos',
          'Conducción prolongada',
          'Ninguna de las anteriores',
        ],
      },
      {
        key: 'physical_activity',
        label: '¿Practicas actividad física o deporte?',
        type: 'select',
        options: ['Sí, con regularidad', 'Ocasionalmente', 'No actualmente'],
      },
      {
        key: 'activity_detail',
        label: 'Si sí, ¿cuál y con qué frecuencia?',
        type: 'text',
        placeholder: 'Ej: Pádel 2 veces/semana, gym 3 días...',
        condition: (data) => data.physical_activity === 'Sí, con regularidad' || data.physical_activity === 'Ocasionalmente',
      },
    ],
  },

  // ============================================
  // BLOQUE 2 — Tu problema
  // ============================================
  {
    id: 'your_problem',
    title: 'Tu problema',
    icon: '💡',
    description: 'Esta sección nos permite preparar la valoración específicamente para ti',
    fields: [
      {
        key: 'main_reason',
        label: '¿Qué te trae a consulta? Cuéntanoslo con tus propias palabras.',
        type: 'textarea',
        required: true,
      },
      {
        key: 'duration',
        label: '¿Cuánto tiempo llevas con este problema?',
        type: 'select',
        options: ['Menos de 2 semanas', '2-6 semanas', '2-6 meses', 'Más de 6 meses'],
        required: true,
      },
      {
        key: 'onset',
        label: '¿Cómo empezó?',
        type: 'select',
        options: [
          'De repente (golpe / accidente)',
          'Poco a poco, sin causa clara',
          'Tras un esfuerzo concreto',
          'No lo recuerdo / otro',
        ],
        required: true,
      },
      {
        key: 'onset_detail',
        label: 'Describe brevemente qué ocurrió',
        type: 'textarea',
        condition: (data) => data.onset === 'De repente (golpe / accidente)',
      },
      {
        key: 'pain_location',
        label: '¿Dónde notas el dolor o la molestia principalmente?',
        type: 'text',
        placeholder: "Sé tan concreto/a como puedas: p. ej. 'cara posterior del muslo derecho'",
        required: true,
      },
      {
        key: 'pain_radiation',
        label: '¿El dolor se queda en esa zona o se irradia/extiende a otra parte?',
        type: 'select',
        options: ['Se queda en el mismo sitio', 'Se extiende (irradia) hacia otra zona'],
      },
      {
        key: 'radiation_detail',
        label: '¿Hacia dónde se irradia?',
        type: 'text',
        placeholder: "P. ej. 'baja por la pierna hasta el pie'",
        condition: (data) => data.pain_radiation === 'Se extiende (irradia) hacia otra zona',
      },
      {
        key: 'pain_sensation',
        label: '¿Cómo describirías la sensación? (puedes marcar varias)',
        type: 'multiselect',
        options: [
          'Dolor sordo / pesado',
          'Pinchazos / punzante',
          'Quemazón / calor',
          'Eléctrico / descarga',
          'Hormigueo / adormecimiento',
          'Opresivo / tensión',
        ],
      },
      {
        key: 'pain_constancy',
        label: '¿El dolor es...?',
        type: 'select',
        options: ['Constante (siempre presente)', 'Intermitente (va y viene)'],
      },
      {
        key: 'pain_intensity_7d',
        label: 'Intensidad media en los últimos 7 días',
        type: 'scale',
        description: '1 = molestia mínima · 10 = el peor dolor imaginable',
        scaleLabels: { min: 'Molestia mínima', max: 'Máximo dolor' },
        required: true,
      },
      {
        key: 'pain_mechanical_behavior',
        label: '¿El dolor cambia según lo que hagas o la postura que adoptes?',
        type: 'select',
        options: [
          'Sí, empeora con ciertas actividades o posturas',
          'Sí, mejora con ciertos movimientos o descanso',
          'No cambia, siempre está igual',
          'Varía sin patrón claro',
        ],
        required: true,
      },
      {
        key: 'pain_aggravates',
        label: '¿Hay movimientos o actividades que claramente lo empeoren?',
        type: 'textarea',
      },
      {
        key: 'pain_movement_timing',
        label: '¿El dolor aparece al empezar el movimiento, durante o al final del recorrido?',
        type: 'select',
        options: [
          'Al iniciar el movimiento',
          'Durante todo el movimiento',
          'Al final del rango de movimiento',
          'No estoy seguro/a',
        ],
      },
      {
        key: 'pain_relieves',
        label: '¿Hay algo que lo alivie?',
        type: 'textarea',
        placeholder: 'P. ej. calor, frío, reposo, movimiento, medicación, posturas concretas...',
      },
      {
        key: 'night_pain',
        label: '¿Te despierta el dolor por la noche?',
        type: 'select',
        options: ['Sí, frecuentemente', 'A veces', 'No'],
      },
      {
        key: 'night_pain_posture_relief',
        label: '¿Mejora al cambiar de postura o al levantarte?',
        type: 'select',
        options: ['Sí, mejora al moverme / levantarme', 'No, sigue igual independientemente'],
        condition: (data) => data.night_pain === 'Sí, frecuentemente' || data.night_pain === 'A veces',
      },
      {
        key: 'morning_stiffness',
        label: '¿Notas rigidez por las mañanas al levantarte?',
        type: 'select',
        options: [
          'No',
          'Sí, se pasa en menos de 30 min',
          'Sí, dura más de 30 min',
          'Sí, dura más de 1 hora',
        ],
      },
    ],
  },

  // ============================================
  // BLOQUE 3 — Señales de alerta (seguridad)
  // ============================================
  {
    id: 'red_flags',
    title: 'Señales de alerta',
    icon: '💡',
    description: 'Necesitamos descartarlas antes de tu sesión. Responde con total tranquilidad.',
    fields: [
      {
        key: 'red_flags',
        label: 'En las últimas semanas, ¿has tenido alguno de estos síntomas? (marca si aplica)',
        type: 'multiselect',
        options: [
          'Fiebre / escalofríos sin causa aparente',
          'Pérdida de peso sin explicación',
          'Antecedentes de cáncer',
          'Debilidad en brazos o piernas',
          'Hormigueo o pérdida de sensibilidad',
          'Dificultad para controlar orina o heces',
          'Adormecimiento en zona genital / interior muslos',
          'Ninguno de los anteriores',
        ],
      },
    ],
  },

  // ============================================
  // BLOQUE 4 — Impacto en tu vida
  // ============================================
  {
    id: 'impact',
    title: 'Impacto en tu vida',
    icon: '📊',
    description: 'Ayúdanos a entender cómo te afecta en tu día a día',
    fields: [
      {
        key: 'functional_limitation',
        label: '¿Qué actividades concretas no puedes hacer o has dejado de hacer por este problema?',
        type: 'textarea',
        placeholder: "P. ej. 'no puedo correr', 'evito jugar con mis hijos', 'no puedo conducir más de 20 min'",
        required: true,
      },
      {
        key: 'quality_of_life_impact',
        label: '¿Cuánto afecta este problema a tu calidad de vida en este momento?',
        type: 'scale',
        description: '1 = casi nada · 10 = lo afecta todo',
        scaleLabels: { min: 'Apenas lo noto', max: 'Afecta todo mi día' },
        required: true,
      },
    ],
  },

  // ============================================
  // BLOQUE 5 — Tratamientos previos
  // ============================================
  {
    id: 'previous_treatments',
    title: 'Tratamientos previos',
    icon: '🩺',
    description: 'Cuéntanos qué has probado hasta ahora',
    fields: [
      {
        key: 'previous_treatment_status',
        label: '¿Has recibido tratamiento antes por este problema?',
        type: 'select',
        options: [
          'No, es la primera vez',
          'Sí, pero sin resultado satisfactorio',
          'Sí, mejoré pero recaí',
          'Sí, con buenos resultados pero volvió',
        ],
      },
      {
        key: 'treatments_tried',
        label: '¿Qué has probado hasta ahora? (marca todo lo que hayas hecho)',
        type: 'multiselect',
        options: [
          'Fisioterapia',
          'Médico / traumatólogo',
          'Osteopatía / quiropraxia',
          'Medicación / infiltraciones',
          'Reposo',
          'Nada todavía',
        ],
        condition: (data) => data.previous_treatment_status !== 'No, es la primera vez',
      },
      {
        key: 'imaging_tests',
        label: '¿Te han hecho pruebas (radiografía, resonancia, ecografía)?',
        type: 'select',
        options: ['No', 'Sí, con resultado normal', 'Sí, con hallazgos'],
      },
      {
        key: 'imaging_findings',
        label: 'Indica los hallazgos',
        type: 'textarea',
        placeholder: 'Ej: Hernia discal L5-S1, rotura parcial del supraespinoso...',
        condition: (data) => data.imaging_tests === 'Sí, con hallazgos',
      },
    ],
  },

  // ============================================
  // BLOQUE 6 — Lo más importante
  // ============================================
  {
    id: 'most_important',
    title: 'Lo más importante',
    icon: '🎯',
    description: 'Estas preguntas nos permiten diseñar un plan realmente útil para ti',
    fields: [
      {
        key: 'if_resolved',
        label: 'Si este problema desapareciera, ¿qué sería lo primero que harías o recuperarías?',
        type: 'textarea',
        placeholder: "Sé concreto/a: 'volvería a correr', 'podría cargar a mi hijo', 'dormiría bien'",
        required: true,
      },
      {
        key: 'why_now',
        label: '¿Por qué has decidido buscar ayuda ahora y no antes?',
        type: 'textarea',
        required: true,
      },
      {
        key: 'if_not_resolved',
        label: '¿Qué crees que puede pasar si no resuelves esto en los próximos meses?',
        type: 'textarea',
      },
      {
        key: 'urgency',
        label: '¿Cuánta urgencia sientes por solucionar este problema?',
        type: 'scale',
        description: '1 = puedo esperar · 10 = necesito resolverlo ya',
        scaleLabels: { min: 'Puedo esperar', max: 'Necesito resolverlo ya' },
        required: true,
      },
      {
        key: 'commitment',
        label: '¿Qué tan dispuesto/a estás a comprometerte con un programa de tratamiento?',
        type: 'select',
        options: [
          'Haré lo que sea necesario para recuperarme',
          'Estoy dispuesto/a a hacer cambios importantes',
          'Solo si es rápido y sin mucho esfuerzo',
          'No lo tengo claro todavía',
        ],
        required: true,
      },
      {
        key: 'barriers',
        label: '¿Algo podría dificultarte seguir un programa completo?',
        type: 'multiselect',
        options: [
          'Falta de tiempo',
          'Preocupación económica',
          'Miedo a no mejorar',
          'Constancia / motivación',
          'No, ninguna barrera importante',
          'Otro',
        ],
      },
      {
        key: 'barriers_other',
        label: 'Especifica',
        type: 'text',
        condition: (data) => data.barriers?.includes('Otro'),
      },
    ],
  },
]

// ============================================
// NOTAS INTERNAS — Solo para el fisioterapeuta
// Estas notas se muestran al profesional después
// de que el paciente complete la anamnesis
// ============================================
export const INTERNAL_CLINICAL_NOTES = [
  {
    id: 'red_flag_alert',
    emoji: '🔴',
    label: 'BANDERAS ROJAS',
    rule: 'Activar alerta si red_flags ≠ "Ninguno de los anteriores"',
  },
  {
    id: 'nocioplastic_profile',
    emoji: '🟡',
    label: 'PERFIL NOCIOPLÁSTICO',
    rule: 'Señales → dolor sin patrón mecánico (pain_mechanical_behavior = "No cambia" o "Varía sin patrón"), no varía con postura, no cambia con movimiento, + alteraciones sensibilidad (pain_sensation incluye hormigueo/quemazón), + sueño alterado → preparar abordaje biopsicosocial.',
  },
  {
    id: 'nociceptive_profile',
    emoji: '🟢',
    label: 'PERFIL NOCICEPTIVO',
    rule: 'Dolor mecánico claro (pain_mechanical_behavior = "Sí, empeora/mejora con..."), localizado (pain_radiation = "Se queda"), varía con actividad/reposo, sin irradiación → candidato directo a programa rehabilitador.',
  },
  {
    id: 'high_disposition',
    emoji: '💰',
    label: 'ALTA DISPOSICIÓN',
    rule: 'urgency ≥ 8 + commitment = "Haré lo que sea necesario" → candidato programa premium.',
  },
  {
    id: 'expected_objections',
    emoji: '⚠️',
    label: 'OBJECIONES PREVISTAS',
    rule: 'barriers incluye "Preocupación económica" o "Falta de tiempo" → preparar cierre con opciones de plan.',
  },
]
