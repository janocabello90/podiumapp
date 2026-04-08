// ============================================
// Assessment Field Definitions
// Modular by body region (shoulder as template)
// ============================================

export interface AssessmentField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'scale' | 'boolean' | 'number'
  placeholder?: string
  description?: string
  options?: string[]
}

export interface AssessmentTest {
  key: string
  label: string
  description?: string
}

export interface AssessmentSection {
  id: string
  title: string
  description: string
  fields: AssessmentField[]
  tests?: AssessmentTest[] // For orthopedic tests (positive/negative/not tested)
  hasNotes: boolean // Whether section has a free-text/dictation notes field
}

export interface BodyRegion {
  id: string
  label: string
  icon: string // emoji
  sections: AssessmentSection[]
}

// ============================================
// SHOULDER - Template region
// ============================================
const shoulderRegion: BodyRegion = {
  id: 'shoulder',
  label: 'Hombro',
  icon: '🦾',
  sections: [
    // 1. Valoración visual
    {
      id: 'visual',
      title: 'Valoración visual',
      description: 'Observación postural y morfológica',
      hasNotes: true,
      fields: [
        { key: 'posture_observation', label: 'Postura general', type: 'select', options: ['Normal', 'Antepulsión de hombro', 'Elevación escapular', 'Rotación interna', 'Otro'] },
        { key: 'symmetry', label: 'Simetría', type: 'select', options: ['Simétrico', 'Asimétrico'] },
        { key: 'muscle_atrophy', label: 'Atrofia muscular visible', type: 'boolean' },
        { key: 'swelling', label: 'Inflamación / edema', type: 'boolean' },
        { key: 'skin_changes', label: 'Cambios en la piel', type: 'select', options: ['Ninguno', 'Enrojecimiento', 'Hematoma', 'Cicatriz', 'Otro'] },
      ],
    },
    // 2. Palpación
    {
      id: 'palpation',
      title: 'Palpación',
      description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular',
      hasNotes: true,
      fields: [],
    },
    // 3. Valoración de la sensibilidad
    {
      id: 'sensitivity',
      title: 'Valoración de la sensibilidad',
      description: 'Exploración neurológica sensitiva',
      hasNotes: true,
      fields: [
        { key: 'dermatome_c4', label: 'Dermatoma C4', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c5', label: 'Dermatoma C5', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c6', label: 'Dermatoma C6', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_t1', label: 'Dermatoma T1', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'light_touch', label: 'Tacto ligero', type: 'select', options: ['Normal', 'Alterado'] },
        { key: 'pain_sensation', label: 'Sensibilidad al dolor', type: 'select', options: ['Normal', 'Alterada'] },
      ],
    },
    // 3. Valoración de la movilidad
    {
      id: 'mobility',
      title: 'Valoración de la movilidad',
      description: 'Rango articular activo y pasivo',
      hasNotes: true,
      fields: [
        { key: 'flexion_active', label: 'Flexión activa (°)', type: 'number', placeholder: '0-180' },
        { key: 'flexion_passive', label: 'Flexión pasiva (°)', type: 'number', placeholder: '0-180' },
        { key: 'abduction_active', label: 'Abducción activa (°)', type: 'number', placeholder: '0-180' },
        { key: 'abduction_passive', label: 'Abducción pasiva (°)', type: 'number', placeholder: '0-180' },
        { key: 'external_rotation_active', label: 'Rotación externa activa (°)', type: 'number', placeholder: '0-90' },
        { key: 'external_rotation_passive', label: 'Rotación externa pasiva (°)', type: 'number', placeholder: '0-90' },
        { key: 'internal_rotation_active', label: 'Rotación interna activa (°)', type: 'number', placeholder: '0-90' },
        { key: 'internal_rotation_passive', label: 'Rotación interna pasiva (°)', type: 'number', placeholder: '0-90' },
        { key: 'painful_arc', label: 'Arco doloroso', type: 'boolean' },
        { key: 'painful_arc_range', label: 'Rango del arco doloroso', type: 'text', placeholder: 'Ej: 60-120°' },
        { key: 'end_feel', label: 'Sensación final', type: 'select', options: ['Normal / elástica', 'Firme', 'Dura / ósea', 'Vacía (por dolor)', 'Espasmódica'] },
      ],
    },
    // 4. Valoración de la fuerza
    {
      id: 'strength',
      title: 'Valoración de la fuerza',
      description: 'Fuerza muscular por grupos',
      hasNotes: true,
      fields: [
        { key: 'flexors_strength', label: 'Flexores', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'abductors_strength', label: 'Abductores', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'external_rotators_strength', label: 'Rotadores externos', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'internal_rotators_strength', label: 'Rotadores internos', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'grip_strength', label: 'Fuerza de prensión', type: 'select', options: ['Normal', 'Reducida', 'Muy reducida'] },
      ],
    },
    // 5. Exploración funcional y escalas
    {
      id: 'functional',
      title: 'Exploración funcional y escalas',
      description: 'Escalas funcionales validadas',
      hasNotes: true,
      fields: [
        { key: 'dash_score', label: 'DASH Score', type: 'number', placeholder: '0-100', description: 'Disabilities of the Arm, Shoulder and Hand' },
        { key: 'constant_score', label: 'Constant-Murley Score', type: 'number', placeholder: '0-100', description: 'Valoración funcional global del hombro' },
        { key: 'eva_pain', label: 'EVA Dolor', type: 'scale', description: 'Escala Visual Analógica del dolor' },
        { key: 'eva_function', label: 'EVA Función', type: 'scale', description: 'Percepción subjetiva de funcionalidad' },
        { key: 'functional_limitation', label: 'Limitación funcional principal', type: 'textarea', placeholder: 'Describe la actividad más limitada...' },
      ],
    },
    // 6. Tests ortopédicos
    {
      id: 'orthopedic_tests',
      title: 'Tests ortopédicos',
      description: 'Tests especiales de hombro',
      hasNotes: true,
      fields: [],
      tests: [
        { key: 'neer', label: 'Test de Neer', description: 'Impingement subacromial' },
        { key: 'hawkins_kennedy', label: 'Test de Hawkins-Kennedy', description: 'Impingement subacromial' },
        { key: 'jobe', label: 'Test de Jobe (Empty Can)', description: 'Supraespinoso' },
        { key: 'patte', label: 'Test de Patte', description: 'Infraespinoso' },
        { key: 'gerber', label: 'Test de Gerber (Lift-off)', description: 'Subescapular' },
        { key: 'speed', label: 'Test de Speed', description: 'Bíceps / SLAP' },
        { key: 'yergason', label: 'Test de Yergason', description: 'Tendón largo del bíceps' },
        { key: 'obrien', label: 'Test de O\'Brien', description: 'SLAP / labrum' },
        { key: 'apprehension', label: 'Test de Aprensión', description: 'Inestabilidad anterior' },
        { key: 'relocation', label: 'Test de Relocalización', description: 'Inestabilidad anterior' },
        { key: 'sulcus_sign', label: 'Signo del Surco', description: 'Inestabilidad inferior' },
        { key: 'cross_body', label: 'Cross-body adduction', description: 'Articulación acromioclavicular' },
        { key: 'drop_arm', label: 'Test de Drop Arm', description: 'Rotura del manguito rotador' },
        { key: 'scapular_assistance', label: 'Test de asistencia escapular', description: 'Discinesia escapular' },
      ],
    },
    // 7. Diagnóstico diferencial
    {
      id: 'diagnosis',
      title: 'Diagnóstico diferencial',
      description: 'Diagnóstico y pruebas complementarias',
      hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'secondary_diagnosis', label: 'Diagnóstico secundario', type: 'textarea', placeholder: 'Otros diagnósticos a considerar...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias solicitadas', type: 'multiselect', options: ['Radiografía', 'Ecografía', 'Resonancia magnética', 'TAC', 'EMG', 'Analítica', 'Ninguna'] },
        { key: 'referral', label: 'Derivación', type: 'select', options: ['No necesaria', 'Traumatología', 'Reumatología', 'Neurología', 'Medicina deportiva', 'Otro especialista'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// KNEE - Placeholder (to be expanded)
// ============================================
const kneeRegion: BodyRegion = {
  id: 'knee',
  label: 'Rodilla',
  icon: '🦵',
  sections: [
    {
      id: 'visual',
      title: 'Valoración visual',
      description: 'Observación postural y morfológica',
      hasNotes: true,
      fields: [
        { key: 'alignment', label: 'Alineación', type: 'select', options: ['Normal', 'Valgo', 'Varo', 'Recurvatum', 'Flexum'] },
        { key: 'swelling', label: 'Derrame / inflamación', type: 'boolean' },
        { key: 'muscle_atrophy', label: 'Atrofia de cuádriceps', type: 'boolean' },
      ],
    },
    {
      id: 'palpation',
      title: 'Palpación',
      description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular',
      hasNotes: true,
      fields: [],
    },
    {
      id: 'sensitivity',
      title: 'Valoración de la sensibilidad',
      description: 'Exploración neurológica sensitiva',
      hasNotes: true,
      fields: [
        { key: 'dermatome_l3', label: 'Dermatoma L3', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_l4', label: 'Dermatoma L4', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
      ],
    },
    {
      id: 'mobility',
      title: 'Valoración de la movilidad',
      description: 'Rango articular activo y pasivo',
      hasNotes: true,
      fields: [
        { key: 'flexion_active', label: 'Flexión activa (°)', type: 'number', placeholder: '0-140' },
        { key: 'flexion_passive', label: 'Flexión pasiva (°)', type: 'number', placeholder: '0-140' },
        { key: 'extension_active', label: 'Extensión activa (°)', type: 'number', placeholder: '0' },
        { key: 'extension_passive', label: 'Extensión pasiva (°)', type: 'number', placeholder: '0' },
      ],
    },
    {
      id: 'strength',
      title: 'Valoración de la fuerza',
      description: 'Fuerza muscular por grupos',
      hasNotes: true,
      fields: [
        { key: 'quadriceps_strength', label: 'Cuádriceps', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'hamstrings_strength', label: 'Isquiotibiales', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
      ],
    },
    {
      id: 'functional',
      title: 'Exploración funcional y escalas',
      description: 'Escalas funcionales validadas',
      hasNotes: true,
      fields: [
        { key: 'lysholm_score', label: 'Lysholm Score', type: 'number', placeholder: '0-100' },
        { key: 'koos_score', label: 'KOOS Score', type: 'number', placeholder: '0-100' },
        { key: 'eva_pain', label: 'EVA Dolor', type: 'scale' },
      ],
    },
    {
      id: 'orthopedic_tests',
      title: 'Tests ortopédicos',
      description: 'Tests especiales de rodilla',
      hasNotes: true,
      fields: [],
      tests: [
        { key: 'lachman', label: 'Test de Lachman', description: 'LCA' },
        { key: 'drawer_anterior', label: 'Cajón anterior', description: 'LCA' },
        { key: 'drawer_posterior', label: 'Cajón posterior', description: 'LCP' },
        { key: 'mcmurray_medial', label: 'McMurray medial', description: 'Menisco medial' },
        { key: 'mcmurray_lateral', label: 'McMurray lateral', description: 'Menisco lateral' },
        { key: 'apley', label: 'Test de Apley', description: 'Meniscos' },
        { key: 'valgus_stress', label: 'Estrés en valgo', description: 'LCM' },
        { key: 'varus_stress', label: 'Estrés en varo', description: 'LCL' },
        { key: 'pivot_shift', label: 'Pivot Shift', description: 'LCA rotacional' },
        { key: 'patellar_apprehension', label: 'Aprensión rotuliana', description: 'Inestabilidad patelofemoral' },
        { key: 'clarke', label: 'Test de Clarke', description: 'Condromalacia patelar' },
      ],
    },
    {
      id: 'diagnosis',
      title: 'Diagnóstico diferencial',
      description: 'Diagnóstico y pruebas complementarias',
      hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'secondary_diagnosis', label: 'Diagnóstico secundario', type: 'textarea', placeholder: 'Otros diagnósticos a considerar...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias solicitadas', type: 'multiselect', options: ['Radiografía', 'Ecografía', 'Resonancia magnética', 'TAC', 'EMG', 'Analítica', 'Ninguna'] },
        { key: 'referral', label: 'Derivación', type: 'select', options: ['No necesaria', 'Traumatología', 'Reumatología', 'Neurología', 'Medicina deportiva', 'Otro especialista'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// SPINE - Placeholder
// ============================================
const spineRegion: BodyRegion = {
  id: 'spine',
  label: 'Columna',
  icon: '🧍',
  sections: [
    {
      id: 'visual', title: 'Valoración visual', description: 'Observación postural', hasNotes: true,
      fields: [
        { key: 'spinal_alignment', label: 'Alineación espinal', type: 'select', options: ['Normal', 'Hipercifosis', 'Hiperlordosis', 'Escoliosis', 'Rectificación'] },
        { key: 'pelvic_tilt', label: 'Basculación pélvica', type: 'select', options: ['Neutra', 'Anteversión', 'Retroversión'] },
      ],
    },
    { id: 'palpation', title: 'Palpación', description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular', hasNotes: true, fields: [] },
    { id: 'sensitivity', title: 'Valoración de la sensibilidad', description: 'Exploración neurológica', hasNotes: true, fields: [] },
    { id: 'mobility', title: 'Valoración de la movilidad', description: 'Rango articular', hasNotes: true, fields: [
      { key: 'flexion', label: 'Flexión', type: 'select', options: ['Completa', 'Limitada leve', 'Limitada moderada', 'Limitada severa'] },
      { key: 'extension', label: 'Extensión', type: 'select', options: ['Completa', 'Limitada leve', 'Limitada moderada', 'Limitada severa'] },
      { key: 'lateral_flexion_r', label: 'Inclinación lateral derecha', type: 'select', options: ['Completa', 'Limitada leve', 'Limitada moderada', 'Limitada severa'] },
      { key: 'lateral_flexion_l', label: 'Inclinación lateral izquierda', type: 'select', options: ['Completa', 'Limitada leve', 'Limitada moderada', 'Limitada severa'] },
      { key: 'rotation_r', label: 'Rotación derecha', type: 'select', options: ['Completa', 'Limitada leve', 'Limitada moderada', 'Limitada severa'] },
      { key: 'rotation_l', label: 'Rotación izquierda', type: 'select', options: ['Completa', 'Limitada leve', 'Limitada moderada', 'Limitada severa'] },
    ] },
    { id: 'strength', title: 'Valoración de la fuerza', description: 'Fuerza muscular', hasNotes: true, fields: [] },
    { id: 'functional', title: 'Exploración funcional y escalas', description: 'Escalas validadas', hasNotes: true, fields: [
      { key: 'oswestry', label: 'Oswestry Disability Index', type: 'number', placeholder: '0-100' },
      { key: 'roland_morris', label: 'Roland-Morris', type: 'number', placeholder: '0-24' },
      { key: 'eva_pain', label: 'EVA Dolor', type: 'scale' },
    ] },
    {
      id: 'orthopedic_tests', title: 'Tests ortopédicos', description: 'Tests especiales de columna', hasNotes: true, fields: [],
      tests: [
        { key: 'slr', label: 'Straight Leg Raise (Lasègue)', description: 'Ciática / hernia discal' },
        { key: 'slump', label: 'Slump Test', description: 'Tensión neural' },
        { key: 'prone_instability', label: 'Prone Instability Test', description: 'Inestabilidad segmentaria' },
        { key: 'centralization', label: 'Fenómeno de centralización', description: 'McKenzie' },
        { key: 'spring_test', label: 'Spring Test', description: 'Hipomovilidad segmentaria' },
      ],
    },
    {
      id: 'diagnosis', title: 'Diagnóstico diferencial', description: 'Diagnóstico y pruebas complementarias', hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias', type: 'multiselect', options: ['Radiografía', 'Resonancia magnética', 'TAC', 'EMG', 'Analítica', 'Ninguna'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// HIP (Cadera)
// ============================================
const hipRegion: BodyRegion = {
  id: 'hip',
  label: 'Cadera',
  icon: '🦴',
  sections: [
    {
      id: 'visual', title: 'Valoración visual', description: 'Observación postural y morfológica', hasNotes: true,
      fields: [
        { key: 'gait_pattern', label: 'Patrón de marcha', type: 'select', options: ['Normal', 'Cojera antiálgica', 'Trendelenburg', 'Coxálgica', 'Otro'] },
        { key: 'pelvic_symmetry', label: 'Simetría pélvica', type: 'select', options: ['Simétrica', 'Asimétrica'] },
        { key: 'leg_length_discrepancy', label: 'Dismetría de MMII', type: 'boolean' },
        { key: 'swelling', label: 'Inflamación / edema', type: 'boolean' },
        { key: 'muscle_atrophy', label: 'Atrofia glútea visible', type: 'boolean' },
      ],
    },
    {
      id: 'palpation', title: 'Palpación', description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular', hasNotes: true, fields: [],
    },
    {
      id: 'sensitivity', title: 'Valoración de la sensibilidad', description: 'Exploración neurológica sensitiva', hasNotes: true,
      fields: [
        { key: 'dermatome_l1', label: 'Dermatoma L1', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_l2', label: 'Dermatoma L2', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_l3', label: 'Dermatoma L3', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'lateral_femoral_cutaneous', label: 'N. femorocutáneo lateral', type: 'select', options: ['Normal', 'Alterado (meralgia parestésica)'] },
      ],
    },
    {
      id: 'mobility', title: 'Valoración de la movilidad', description: 'Rango articular activo y pasivo', hasNotes: true,
      fields: [
        { key: 'flexion_active', label: 'Flexión activa (°)', type: 'number', placeholder: '0-125' },
        { key: 'flexion_passive', label: 'Flexión pasiva (°)', type: 'number', placeholder: '0-125' },
        { key: 'extension_active', label: 'Extensión activa (°)', type: 'number', placeholder: '0-30' },
        { key: 'extension_passive', label: 'Extensión pasiva (°)', type: 'number', placeholder: '0-30' },
        { key: 'abduction_active', label: 'Abducción activa (°)', type: 'number', placeholder: '0-45' },
        { key: 'abduction_passive', label: 'Abducción pasiva (°)', type: 'number', placeholder: '0-45' },
        { key: 'adduction_active', label: 'Aducción activa (°)', type: 'number', placeholder: '0-30' },
        { key: 'external_rotation_active', label: 'Rotación externa activa (°)', type: 'number', placeholder: '0-45' },
        { key: 'external_rotation_passive', label: 'Rotación externa pasiva (°)', type: 'number', placeholder: '0-45' },
        { key: 'internal_rotation_active', label: 'Rotación interna activa (°)', type: 'number', placeholder: '0-45' },
        { key: 'internal_rotation_passive', label: 'Rotación interna pasiva (°)', type: 'number', placeholder: '0-45' },
        { key: 'end_feel', label: 'Sensación final', type: 'select', options: ['Normal / elástica', 'Firme', 'Dura / ósea', 'Vacía (por dolor)', 'Espasmódica'] },
      ],
    },
    {
      id: 'strength', title: 'Valoración de la fuerza', description: 'Fuerza muscular por grupos', hasNotes: true,
      fields: [
        { key: 'flexors_strength', label: 'Flexores (psoas-ilíaco)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'extensors_strength', label: 'Extensores (glúteo mayor)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'abductors_strength', label: 'Abductores (glúteo medio)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'adductors_strength', label: 'Aductores', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'external_rotators_strength', label: 'Rotadores externos', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'internal_rotators_strength', label: 'Rotadores internos', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
      ],
    },
    {
      id: 'functional', title: 'Exploración funcional y escalas', description: 'Escalas funcionales validadas', hasNotes: true,
      fields: [
        { key: 'harris_hip_score', label: 'Harris Hip Score', type: 'number', placeholder: '0-100', description: 'Valoración funcional de cadera' },
        { key: 'womac', label: 'WOMAC', type: 'number', placeholder: '0-96', description: 'Western Ontario and McMaster Universities Osteoarthritis Index' },
        { key: 'eva_pain', label: 'EVA Dolor', type: 'scale', description: 'Escala Visual Analógica del dolor' },
        { key: 'eva_function', label: 'EVA Función', type: 'scale', description: 'Percepción subjetiva de funcionalidad' },
        { key: 'functional_limitation', label: 'Limitación funcional principal', type: 'textarea', placeholder: 'Describe la actividad más limitada...' },
      ],
    },
    {
      id: 'orthopedic_tests', title: 'Tests ortopédicos', description: 'Tests especiales de cadera', hasNotes: true, fields: [],
      tests: [
        { key: 'thomas', label: 'Test de Thomas', description: 'Contractura en flexión del psoas' },
        { key: 'faber', label: 'Test FABER (Patrick)', description: 'Articulación coxofemoral / sacroilíaca' },
        { key: 'fadir', label: 'Test FADIR', description: 'Pinzamiento femoroacetabular' },
        { key: 'trendelenburg', label: 'Test de Trendelenburg', description: 'Insuficiencia del glúteo medio' },
        { key: 'ober', label: 'Test de Ober', description: 'Contractura de banda iliotibial' },
        { key: 'piriformis', label: 'Test del piriforme', description: 'Síndrome del piriforme' },
        { key: 'log_roll', label: 'Log Roll Test', description: 'Patología intraarticular' },
        { key: 'craig', label: 'Test de Craig', description: 'Anteversión femoral' },
        { key: 'anvil_test', label: 'Test del yunque', description: 'Fractura de cadera / patología ósea' },
        { key: 'resisted_slr', label: 'Stinchfield (SLR resistido)', description: 'Patología intraarticular de cadera' },
      ],
    },
    {
      id: 'diagnosis', title: 'Diagnóstico diferencial', description: 'Diagnóstico y pruebas complementarias', hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'secondary_diagnosis', label: 'Diagnóstico secundario', type: 'textarea', placeholder: 'Otros diagnósticos a considerar...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias solicitadas', type: 'multiselect', options: ['Radiografía', 'Ecografía', 'Resonancia magnética', 'TAC', 'EMG', 'Analítica', 'Ninguna'] },
        { key: 'referral', label: 'Derivación', type: 'select', options: ['No necesaria', 'Traumatología', 'Reumatología', 'Neurología', 'Medicina deportiva', 'Otro especialista'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// ANKLE/FOOT (Tobillo/Pie)
// ============================================
const ankleRegion: BodyRegion = {
  id: 'ankle',
  label: 'Tobillo / Pie',
  icon: '🦶',
  sections: [
    {
      id: 'visual', title: 'Valoración visual', description: 'Observación postural y morfológica', hasNotes: true,
      fields: [
        { key: 'foot_type', label: 'Tipo de pie', type: 'select', options: ['Normal', 'Plano', 'Cavo', 'Equino', 'Otro'] },
        { key: 'hindfoot_alignment', label: 'Alineación retropié', type: 'select', options: ['Neutro', 'Valgo', 'Varo'] },
        { key: 'swelling', label: 'Inflamación / edema', type: 'boolean' },
        { key: 'ecchymosis', label: 'Equimosis', type: 'boolean' },
        { key: 'deformities', label: 'Deformidades', type: 'select', options: ['Ninguna', 'Hallux valgus', 'Dedos en garra', 'Dedos en martillo', 'Otro'] },
        { key: 'gait_pattern', label: 'Patrón de marcha', type: 'select', options: ['Normal', 'Antiálgica', 'Equina', 'Calcánea', 'Supinadora', 'Pronadora'] },
      ],
    },
    {
      id: 'palpation', title: 'Palpación', description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular', hasNotes: true, fields: [],
    },
    {
      id: 'sensitivity', title: 'Valoración de la sensibilidad', description: 'Exploración neurológica sensitiva', hasNotes: true,
      fields: [
        { key: 'dermatome_l4', label: 'Dermatoma L4 (medial)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_l5', label: 'Dermatoma L5 (dorso pie)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_s1', label: 'Dermatoma S1 (lateral/planta)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'tibial_nerve', label: 'N. tibial posterior', type: 'select', options: ['Normal', 'Alterado'] },
        { key: 'peroneal_nerve', label: 'N. peroneo', type: 'select', options: ['Normal', 'Alterado'] },
      ],
    },
    {
      id: 'mobility', title: 'Valoración de la movilidad', description: 'Rango articular activo y pasivo', hasNotes: true,
      fields: [
        { key: 'dorsiflexion_active', label: 'Dorsiflexión activa (°)', type: 'number', placeholder: '0-20' },
        { key: 'dorsiflexion_passive', label: 'Dorsiflexión pasiva (°)', type: 'number', placeholder: '0-20' },
        { key: 'plantarflexion_active', label: 'Flexión plantar activa (°)', type: 'number', placeholder: '0-50' },
        { key: 'plantarflexion_passive', label: 'Flexión plantar pasiva (°)', type: 'number', placeholder: '0-50' },
        { key: 'inversion_active', label: 'Inversión activa (°)', type: 'number', placeholder: '0-35' },
        { key: 'inversion_passive', label: 'Inversión pasiva (°)', type: 'number', placeholder: '0-35' },
        { key: 'eversion_active', label: 'Eversión activa (°)', type: 'number', placeholder: '0-20' },
        { key: 'eversion_passive', label: 'Eversión pasiva (°)', type: 'number', placeholder: '0-20' },
        { key: 'first_mtp_extension', label: 'Extensión 1ª MTF (°)', type: 'number', placeholder: '0-70' },
        { key: 'end_feel', label: 'Sensación final', type: 'select', options: ['Normal / elástica', 'Firme', 'Dura / ósea', 'Vacía (por dolor)', 'Espasmódica'] },
      ],
    },
    {
      id: 'strength', title: 'Valoración de la fuerza', description: 'Fuerza muscular por grupos', hasNotes: true,
      fields: [
        { key: 'dorsiflexors_strength', label: 'Dorsiflexores (tibial anterior)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'plantarflexors_strength', label: 'Flexores plantares (tríceps sural)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'invertors_strength', label: 'Inversores (tibial posterior)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'evertors_strength', label: 'Eversores (peroneos)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'toe_flexors_strength', label: 'Flexores de dedos', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'single_leg_heel_raise', label: 'Elevación talón unipodal', type: 'select', options: ['No consigue', '1-5 rep', '6-15 rep', '16-25 rep', '>25 rep'] },
      ],
    },
    {
      id: 'functional', title: 'Exploración funcional y escalas', description: 'Escalas funcionales validadas', hasNotes: true,
      fields: [
        { key: 'aofas_score', label: 'AOFAS Score', type: 'number', placeholder: '0-100', description: 'American Orthopaedic Foot & Ankle Society' },
        { key: 'faam_score', label: 'FAAM Score', type: 'number', placeholder: '0-100', description: 'Foot and Ankle Ability Measure' },
        { key: 'eva_pain', label: 'EVA Dolor', type: 'scale', description: 'Escala Visual Analógica del dolor' },
        { key: 'functional_limitation', label: 'Limitación funcional principal', type: 'textarea', placeholder: 'Describe la actividad más limitada...' },
      ],
    },
    {
      id: 'orthopedic_tests', title: 'Tests ortopédicos', description: 'Tests especiales de tobillo/pie', hasNotes: true, fields: [],
      tests: [
        { key: 'anterior_drawer', label: 'Cajón anterior de tobillo', description: 'Ligamento peroneo-astragalino anterior (LPAA)' },
        { key: 'talar_tilt', label: 'Tilt astragalino', description: 'Ligamentos laterales' },
        { key: 'thompson', label: 'Test de Thompson', description: 'Rotura del tendón de Aquiles' },
        { key: 'squeeze_test', label: 'Squeeze Test', description: 'Sindesmosis tibioperonea' },
        { key: 'external_rotation_stress', label: 'Estrés en rotación externa', description: 'Sindesmosis tibioperonea' },
        { key: 'tinel_tarsal', label: 'Tinel en túnel tarsiano', description: 'Síndrome del túnel tarsiano' },
        { key: 'windlass', label: 'Test de Windlass (Jack)', description: 'Fascitis plantar' },
        { key: 'mulder_click', label: 'Click de Mulder', description: 'Neuroma de Morton' },
        { key: 'ottawa_rules', label: 'Reglas de Ottawa', description: 'Indicación de radiografía' },
        { key: 'silfverskiold', label: 'Test de Silfverskiöld', description: 'Acortamiento gastrocnemio vs sóleo' },
      ],
    },
    {
      id: 'diagnosis', title: 'Diagnóstico diferencial', description: 'Diagnóstico y pruebas complementarias', hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'secondary_diagnosis', label: 'Diagnóstico secundario', type: 'textarea', placeholder: 'Otros diagnósticos a considerar...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias solicitadas', type: 'multiselect', options: ['Radiografía', 'Ecografía', 'Resonancia magnética', 'TAC', 'EMG', 'Analítica', 'Ninguna'] },
        { key: 'referral', label: 'Derivación', type: 'select', options: ['No necesaria', 'Traumatología', 'Reumatología', 'Neurología', 'Medicina deportiva', 'Podología', 'Otro especialista'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// ELBOW (Codo)
// ============================================
const elbowRegion: BodyRegion = {
  id: 'elbow',
  label: 'Codo',
  icon: '💪',
  sections: [
    {
      id: 'visual', title: 'Valoración visual', description: 'Observación postural y morfológica', hasNotes: true,
      fields: [
        { key: 'carrying_angle', label: 'Ángulo de carga', type: 'select', options: ['Normal', 'Cubitus valgus', 'Cubitus varus'] },
        { key: 'swelling', label: 'Inflamación / derrame', type: 'boolean' },
        { key: 'muscle_atrophy', label: 'Atrofia muscular visible', type: 'boolean' },
        { key: 'deformity', label: 'Deformidad', type: 'select', options: ['Ninguna', 'Nódulos', 'Bursitis olecraniana', 'Otra'] },
      ],
    },
    {
      id: 'palpation', title: 'Palpación', description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular', hasNotes: true, fields: [],
    },
    {
      id: 'sensitivity', title: 'Valoración de la sensibilidad', description: 'Exploración neurológica sensitiva', hasNotes: true,
      fields: [
        { key: 'dermatome_c5', label: 'Dermatoma C5', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c6', label: 'Dermatoma C6', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c7', label: 'Dermatoma C7', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c8', label: 'Dermatoma C8', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'ulnar_nerve_tinel', label: 'Tinel n. cubital (canal epitrócleo-olecraniano)', type: 'select', options: ['Normal', 'Positivo'] },
      ],
    },
    {
      id: 'mobility', title: 'Valoración de la movilidad', description: 'Rango articular activo y pasivo', hasNotes: true,
      fields: [
        { key: 'flexion_active', label: 'Flexión activa (°)', type: 'number', placeholder: '0-145' },
        { key: 'flexion_passive', label: 'Flexión pasiva (°)', type: 'number', placeholder: '0-145' },
        { key: 'extension_active', label: 'Extensión activa (°)', type: 'number', placeholder: '0' },
        { key: 'extension_passive', label: 'Extensión pasiva (°)', type: 'number', placeholder: '0' },
        { key: 'pronation_active', label: 'Pronación activa (°)', type: 'number', placeholder: '0-80' },
        { key: 'pronation_passive', label: 'Pronación pasiva (°)', type: 'number', placeholder: '0-80' },
        { key: 'supination_active', label: 'Supinación activa (°)', type: 'number', placeholder: '0-80' },
        { key: 'supination_passive', label: 'Supinación pasiva (°)', type: 'number', placeholder: '0-80' },
        { key: 'end_feel', label: 'Sensación final', type: 'select', options: ['Normal / elástica', 'Firme', 'Dura / ósea', 'Vacía (por dolor)', 'Espasmódica'] },
      ],
    },
    {
      id: 'strength', title: 'Valoración de la fuerza', description: 'Fuerza muscular por grupos', hasNotes: true,
      fields: [
        { key: 'flexors_strength', label: 'Flexores (bíceps/braquial)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'extensors_strength', label: 'Extensores (tríceps)', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'pronators_strength', label: 'Pronadores', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'supinators_strength', label: 'Supinadores', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'wrist_extensors_strength', label: 'Extensores de muñeca', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'wrist_flexors_strength', label: 'Flexores de muñeca', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'grip_strength', label: 'Fuerza de prensión', type: 'select', options: ['Normal', 'Reducida', 'Muy reducida'] },
      ],
    },
    {
      id: 'functional', title: 'Exploración funcional y escalas', description: 'Escalas funcionales validadas', hasNotes: true,
      fields: [
        { key: 'dash_score', label: 'DASH Score', type: 'number', placeholder: '0-100', description: 'Disabilities of the Arm, Shoulder and Hand' },
        { key: 'mayo_elbow_score', label: 'Mayo Elbow Performance Score', type: 'number', placeholder: '0-100', description: 'Valoración funcional del codo' },
        { key: 'eva_pain', label: 'EVA Dolor', type: 'scale', description: 'Escala Visual Analógica del dolor' },
        { key: 'functional_limitation', label: 'Limitación funcional principal', type: 'textarea', placeholder: 'Describe la actividad más limitada...' },
      ],
    },
    {
      id: 'orthopedic_tests', title: 'Tests ortopédicos', description: 'Tests especiales de codo', hasNotes: true, fields: [],
      tests: [
        { key: 'cozen', label: 'Test de Cozen', description: 'Epicondilitis lateral (codo de tenista)' },
        { key: 'mill', label: 'Test de Mill', description: 'Epicondilitis lateral' },
        { key: 'maudsley', label: 'Test de Maudsley (3er dedo)', description: 'Epicondilitis lateral' },
        { key: 'reverse_cozen', label: 'Test de Cozen invertido', description: 'Epitrocleitis (codo de golfista)' },
        { key: 'valgus_stress', label: 'Estrés en valgo', description: 'Ligamento colateral medial (LCM)' },
        { key: 'varus_stress', label: 'Estrés en varo', description: 'Ligamento colateral lateral (LCL)' },
        { key: 'pivot_shift_lateral', label: 'Pivot Shift lateral', description: 'Inestabilidad posterolateral rotatoria' },
        { key: 'tinel_cubital', label: 'Tinel del canal cubital', description: 'Neuropatía cubital' },
        { key: 'elbow_flexion_compression', label: 'Flexión-compresión', description: 'Neuropatía cubital' },
      ],
    },
    {
      id: 'diagnosis', title: 'Diagnóstico diferencial', description: 'Diagnóstico y pruebas complementarias', hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'secondary_diagnosis', label: 'Diagnóstico secundario', type: 'textarea', placeholder: 'Otros diagnósticos a considerar...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias solicitadas', type: 'multiselect', options: ['Radiografía', 'Ecografía', 'Resonancia magnética', 'TAC', 'EMG', 'Analítica', 'Ninguna'] },
        { key: 'referral', label: 'Derivación', type: 'select', options: ['No necesaria', 'Traumatología', 'Reumatología', 'Neurología', 'Medicina deportiva', 'Otro especialista'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// WRIST/HAND (Muñeca/Mano)
// ============================================
const wristRegion: BodyRegion = {
  id: 'wrist',
  label: 'Muñeca / Mano',
  icon: '🤚',
  sections: [
    {
      id: 'visual', title: 'Valoración visual', description: 'Observación postural y morfológica', hasNotes: true,
      fields: [
        { key: 'swelling', label: 'Inflamación / edema', type: 'boolean' },
        { key: 'deformities', label: 'Deformidades', type: 'select', options: ['Ninguna', 'Desviación cubital', 'Nódulos de Heberden', 'Nódulos de Bouchard', 'Deformidad en boutonnière', 'Deformidad en cuello de cisne', 'Rizartrosis', 'Otra'] },
        { key: 'muscle_atrophy', label: 'Atrofia muscular', type: 'select', options: ['Ninguna', 'Eminencia tenar', 'Eminencia hipotenar', 'Interóseos', 'Generalizada'] },
        { key: 'skin_changes', label: 'Cambios en la piel', type: 'select', options: ['Ninguno', 'Enrojecimiento', 'Palidez', 'Cianosis', 'Dupuytren', 'Cicatriz', 'Otro'] },
        { key: 'nail_changes', label: 'Alteraciones ungueales', type: 'boolean' },
      ],
    },
    {
      id: 'palpation', title: 'Palpación', description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular', hasNotes: true, fields: [],
    },
    {
      id: 'sensitivity', title: 'Valoración de la sensibilidad', description: 'Exploración neurológica sensitiva', hasNotes: true,
      fields: [
        { key: 'median_nerve', label: 'N. mediano (pulgar-medio)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'ulnar_nerve', label: 'N. cubital (anular-meñique)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'radial_nerve', label: 'N. radial (dorso mano)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'two_point_discrimination', label: 'Discriminación 2 puntos', type: 'select', options: ['Normal (<6mm)', 'Alterada (6-10mm)', 'Muy alterada (>10mm)'] },
      ],
    },
    {
      id: 'mobility', title: 'Valoración de la movilidad', description: 'Rango articular activo y pasivo', hasNotes: true,
      fields: [
        { key: 'wrist_flexion_active', label: 'Flexión muñeca activa (°)', type: 'number', placeholder: '0-80' },
        { key: 'wrist_flexion_passive', label: 'Flexión muñeca pasiva (°)', type: 'number', placeholder: '0-80' },
        { key: 'wrist_extension_active', label: 'Extensión muñeca activa (°)', type: 'number', placeholder: '0-70' },
        { key: 'wrist_extension_passive', label: 'Extensión muñeca pasiva (°)', type: 'number', placeholder: '0-70' },
        { key: 'radial_deviation', label: 'Desviación radial (°)', type: 'number', placeholder: '0-20' },
        { key: 'ulnar_deviation', label: 'Desviación cubital (°)', type: 'number', placeholder: '0-30' },
        { key: 'thumb_opposition', label: 'Oposición del pulgar', type: 'select', options: ['Completa', 'Limitada leve', 'Limitada moderada', 'Limitada severa', 'Ausente'] },
        { key: 'finger_flexion', label: 'Flexión global dedos', type: 'select', options: ['Completa (puño cerrado)', 'Limitada leve', 'Limitada moderada', 'Limitada severa'] },
        { key: 'finger_extension', label: 'Extensión global dedos', type: 'select', options: ['Completa', 'Limitada leve', 'Limitada moderada', 'Limitada severa'] },
      ],
    },
    {
      id: 'strength', title: 'Valoración de la fuerza', description: 'Fuerza muscular y prensión', hasNotes: true,
      fields: [
        { key: 'grip_strength', label: 'Fuerza de prensión (dinamómetro)', type: 'text', placeholder: 'Ej: 30 kg' },
        { key: 'pinch_strength', label: 'Fuerza de pinza', type: 'text', placeholder: 'Ej: 8 kg' },
        { key: 'wrist_flexors', label: 'Flexores de muñeca', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'wrist_extensors', label: 'Extensores de muñeca', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'thumb_abduction', label: 'Abducción del pulgar', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'finger_intrinsics', label: 'Intrínsecos de la mano', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
      ],
    },
    {
      id: 'functional', title: 'Exploración funcional y escalas', description: 'Escalas funcionales validadas', hasNotes: true,
      fields: [
        { key: 'dash_score', label: 'DASH Score', type: 'number', placeholder: '0-100', description: 'Disabilities of the Arm, Shoulder and Hand' },
        { key: 'prwhe_score', label: 'PRWHE Score', type: 'number', placeholder: '0-100', description: 'Patient-Rated Wrist/Hand Evaluation' },
        { key: 'eva_pain', label: 'EVA Dolor', type: 'scale', description: 'Escala Visual Analógica del dolor' },
        { key: 'functional_limitation', label: 'Limitación funcional principal', type: 'textarea', placeholder: 'Describe la actividad más limitada...' },
      ],
    },
    {
      id: 'orthopedic_tests', title: 'Tests ortopédicos', description: 'Tests especiales de muñeca/mano', hasNotes: true, fields: [],
      tests: [
        { key: 'phalen', label: 'Test de Phalen', description: 'Síndrome del túnel carpiano' },
        { key: 'reverse_phalen', label: 'Phalen invertido', description: 'Síndrome del túnel carpiano' },
        { key: 'tinel_carpal', label: 'Tinel en túnel carpiano', description: 'Síndrome del túnel carpiano' },
        { key: 'durkan', label: 'Test de Durkan (compresión)', description: 'Síndrome del túnel carpiano' },
        { key: 'finkelstein', label: 'Test de Finkelstein', description: 'Tenosinovitis de De Quervain' },
        { key: 'watson', label: 'Test de Watson (scaphoid shift)', description: 'Inestabilidad escafolunar' },
        { key: 'grind_test', label: 'Grind Test CMC', description: 'Rizartrosis (artrosis trapecio-metacarpiana)' },
        { key: 'bunnel_littler', label: 'Test de Bunnell-Littler', description: 'Contractura intrínseca' },
        { key: 'allen_test', label: 'Test de Allen', description: 'Permeabilidad arterial (radial/cubital)' },
        { key: 'froment', label: 'Signo de Froment', description: 'Parálisis del nervio cubital' },
      ],
    },
    {
      id: 'diagnosis', title: 'Diagnóstico diferencial', description: 'Diagnóstico y pruebas complementarias', hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'secondary_diagnosis', label: 'Diagnóstico secundario', type: 'textarea', placeholder: 'Otros diagnósticos a considerar...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias solicitadas', type: 'multiselect', options: ['Radiografía', 'Ecografía', 'Resonancia magnética', 'TAC', 'EMG', 'Analítica', 'Ninguna'] },
        { key: 'referral', label: 'Derivación', type: 'select', options: ['No necesaria', 'Traumatología', 'Reumatología', 'Neurología', 'Cirugía de mano', 'Otro especialista'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// CERVICAL (Cervical)
// ============================================
const cervicalRegion: BodyRegion = {
  id: 'cervical',
  label: 'Cervical',
  icon: '🧠',
  sections: [
    {
      id: 'visual', title: 'Valoración visual', description: 'Observación postural y morfológica', hasNotes: true,
      fields: [
        { key: 'head_position', label: 'Posición de la cabeza', type: 'select', options: ['Normal', 'Anteriorizada', 'Lateralizada derecha', 'Lateralizada izquierda', 'Rotada'] },
        { key: 'cervical_lordosis', label: 'Lordosis cervical', type: 'select', options: ['Normal', 'Rectificación', 'Hiperlordosis', 'Cifosis'] },
        { key: 'shoulder_symmetry', label: 'Simetría de hombros', type: 'select', options: ['Simétrica', 'Elevación derecha', 'Elevación izquierda'] },
        { key: 'muscle_spasm', label: 'Espasmo muscular visible', type: 'boolean' },
        { key: 'torticollis', label: 'Tortícolis', type: 'boolean' },
      ],
    },
    {
      id: 'palpation', title: 'Palpación', description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular', hasNotes: true, fields: [],
    },
    {
      id: 'sensitivity', title: 'Valoración de la sensibilidad', description: 'Exploración neurológica sensitiva', hasNotes: true,
      fields: [
        { key: 'dermatome_c2', label: 'Dermatoma C2 (occipital)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c3', label: 'Dermatoma C3 (cuello)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c4', label: 'Dermatoma C4 (hombro)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c5', label: 'Dermatoma C5 (deltoides)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c6', label: 'Dermatoma C6 (pulgar)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c7', label: 'Dermatoma C7 (dedo medio)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_c8', label: 'Dermatoma C8 (meñique)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
        { key: 'dermatome_t1', label: 'Dermatoma T1 (antebrazo medial)', type: 'select', options: ['Normal', 'Hipoestesia', 'Hiperestesia', 'Anestesia'] },
      ],
    },
    {
      id: 'mobility', title: 'Valoración de la movilidad', description: 'Rango articular activo y pasivo', hasNotes: true,
      fields: [
        { key: 'flexion_active', label: 'Flexión activa (°)', type: 'number', placeholder: '0-50' },
        { key: 'flexion_passive', label: 'Flexión pasiva (°)', type: 'number', placeholder: '0-50' },
        { key: 'extension_active', label: 'Extensión activa (°)', type: 'number', placeholder: '0-60' },
        { key: 'extension_passive', label: 'Extensión pasiva (°)', type: 'number', placeholder: '0-60' },
        { key: 'lateral_flexion_r_active', label: 'Inclinación lateral dcha activa (°)', type: 'number', placeholder: '0-45' },
        { key: 'lateral_flexion_l_active', label: 'Inclinación lateral izqda activa (°)', type: 'number', placeholder: '0-45' },
        { key: 'rotation_r_active', label: 'Rotación derecha activa (°)', type: 'number', placeholder: '0-80' },
        { key: 'rotation_l_active', label: 'Rotación izquierda activa (°)', type: 'number', placeholder: '0-80' },
        { key: 'painful_movement', label: 'Movimiento más doloroso', type: 'select', options: ['Flexión', 'Extensión', 'Inclinación lateral', 'Rotación', 'Ninguno', 'Todos'] },
        { key: 'end_feel', label: 'Sensación final', type: 'select', options: ['Normal / elástica', 'Firme', 'Dura / ósea', 'Vacía (por dolor)', 'Espasmódica'] },
      ],
    },
    {
      id: 'strength', title: 'Valoración de la fuerza', description: 'Fuerza muscular (miotomas)', hasNotes: true,
      fields: [
        { key: 'c5_myotome', label: 'C5 - Deltoides / bíceps', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'c6_myotome', label: 'C6 - Ext. muñeca / bíceps', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'c7_myotome', label: 'C7 - Tríceps / flex. muñeca', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'c8_myotome', label: 'C8 - Flex. dedos / intrínsecos', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 't1_myotome', label: 'T1 - Interóseos', type: 'select', options: ['0 - Nula', '1 - Vestigios', '2 - Escasa', '3 - Regular', '4 - Buena', '5 - Normal'] },
        { key: 'deep_flexors', label: 'Flexores profundos cervicales', type: 'select', options: ['Buen control', 'Control reducido', 'Sin control'] },
      ],
    },
    {
      id: 'functional', title: 'Exploración funcional y escalas', description: 'Escalas funcionales validadas', hasNotes: true,
      fields: [
        { key: 'ndi_score', label: 'NDI (Neck Disability Index)', type: 'number', placeholder: '0-50', description: 'Índice de discapacidad cervical' },
        { key: 'nprs', label: 'NPRS', type: 'scale', description: 'Numeric Pain Rating Scale' },
        { key: 'eva_pain', label: 'EVA Dolor', type: 'scale', description: 'Escala Visual Analógica del dolor' },
        { key: 'headache_frequency', label: 'Frecuencia cefaleas', type: 'select', options: ['Nunca', 'Ocasional', 'Semanal', 'Diaria'] },
        { key: 'dizziness', label: 'Mareos / vértigo', type: 'boolean' },
        { key: 'functional_limitation', label: 'Limitación funcional principal', type: 'textarea', placeholder: 'Describe la actividad más limitada...' },
      ],
    },
    {
      id: 'orthopedic_tests', title: 'Tests ortopédicos', description: 'Tests especiales cervicales', hasNotes: true, fields: [],
      tests: [
        { key: 'spurling', label: 'Test de Spurling', description: 'Radiculopatía cervical' },
        { key: 'distraction', label: 'Test de distracción cervical', description: 'Radiculopatía cervical (alivio)' },
        { key: 'ultt1', label: 'ULTT1 (n. mediano)', description: 'Tensión neural miembro superior' },
        { key: 'ultt2a', label: 'ULTT2a (n. radial)', description: 'Tensión neural miembro superior' },
        { key: 'ultt2b', label: 'ULTT2b (n. cubital)', description: 'Tensión neural miembro superior' },
        { key: 'cranial_cervical_flexion', label: 'Test flexión cráneo-cervical', description: 'Control motor flexores profundos' },
        { key: 'sharp_purser', label: 'Test de Sharp-Purser', description: 'Inestabilidad C1-C2 (precaución)' },
        { key: 'alar_ligament', label: 'Test ligamentos alares', description: 'Estabilidad cervical alta' },
        { key: 'vertebral_artery', label: 'Test arteria vertebral', description: 'Insuficiencia vertebrobasilar (precaución)' },
        { key: 'cervical_flexion_rotation', label: 'Test flexión-rotación cervical', description: 'Cefalea cervicogénica (C1-C2)' },
        { key: 'shoulder_abduction_relief', label: 'Signo alivio por abducción', description: 'Radiculopatía cervical' },
      ],
    },
    {
      id: 'diagnosis', title: 'Diagnóstico diferencial', description: 'Diagnóstico y pruebas complementarias', hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'secondary_diagnosis', label: 'Diagnóstico secundario', type: 'textarea', placeholder: 'Otros diagnósticos a considerar...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias solicitadas', type: 'multiselect', options: ['Radiografía', 'Resonancia magnética', 'TAC', 'EMG', 'Analítica', 'Doppler vertebral', 'Ninguna'] },
        { key: 'referral', label: 'Derivación', type: 'select', options: ['No necesaria', 'Traumatología', 'Neurología', 'Neurocirugía', 'Reumatología', 'Otro especialista'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// TMJ (ATM - Articulación Temporomandibular)
// ============================================
const tmjRegion: BodyRegion = {
  id: 'tmj',
  label: 'ATM',
  icon: '🦷',
  sections: [
    {
      id: 'visual', title: 'Valoración visual', description: 'Observación facial y mandibular', hasNotes: true,
      fields: [
        { key: 'facial_symmetry', label: 'Simetría facial', type: 'select', options: ['Simétrica', 'Asimétrica'] },
        { key: 'mandibular_deviation', label: 'Desviación mandibular en reposo', type: 'select', options: ['Centrada', 'Desviada a derecha', 'Desviada a izquierda'] },
        { key: 'swelling', label: 'Inflamación periarticular', type: 'boolean' },
        { key: 'muscle_hypertrophy', label: 'Hipertrofia maseteros', type: 'boolean' },
        { key: 'cervical_posture', label: 'Postura cervical asociada', type: 'select', options: ['Normal', 'Anteriorizada', 'Extensión cervical alta'] },
      ],
    },
    {
      id: 'palpation', title: 'Palpación', description: 'Hallazgos palpatorios: puntos dolorosos, tensión, temperatura, textura tisular', hasNotes: true, fields: [],
    },
    {
      id: 'sensitivity', title: 'Valoración de la sensibilidad', description: 'Exploración neurológica y muscular', hasNotes: true,
      fields: [
        { key: 'trigeminal_v1', label: 'V1 - Oftálmico', type: 'select', options: ['Normal', 'Alterado'] },
        { key: 'trigeminal_v2', label: 'V2 - Maxilar', type: 'select', options: ['Normal', 'Alterado'] },
        { key: 'trigeminal_v3', label: 'V3 - Mandibular', type: 'select', options: ['Normal', 'Alterado'] },
        { key: 'masseter_palpation', label: 'Palpación masetero', type: 'select', options: ['Indoloro', 'Dolor leve', 'Dolor moderado', 'Dolor severo'] },
        { key: 'temporal_palpation', label: 'Palpación temporal', type: 'select', options: ['Indoloro', 'Dolor leve', 'Dolor moderado', 'Dolor severo'] },
        { key: 'pterygoid_lateral', label: 'Palpación pterigoideo lateral', type: 'select', options: ['Indoloro', 'Dolor leve', 'Dolor moderado', 'Dolor severo'] },
        { key: 'pterygoid_medial', label: 'Palpación pterigoideo medial', type: 'select', options: ['Indoloro', 'Dolor leve', 'Dolor moderado', 'Dolor severo'] },
      ],
    },
    {
      id: 'mobility', title: 'Valoración de la movilidad', description: 'Rango articular mandibular', hasNotes: true,
      fields: [
        { key: 'mouth_opening', label: 'Apertura bucal máxima (mm)', type: 'number', placeholder: '35-55', description: 'Normal: 40-55mm (3 dedos)' },
        { key: 'opening_pattern', label: 'Patrón de apertura', type: 'select', options: ['Recto', 'Desviación a derecha', 'Desviación a izquierda', 'Desviación en S', 'Deflexión a derecha', 'Deflexión a izquierda'] },
        { key: 'lateral_excursion_r', label: 'Excursión lateral derecha (mm)', type: 'number', placeholder: '8-12' },
        { key: 'lateral_excursion_l', label: 'Excursión lateral izquierda (mm)', type: 'number', placeholder: '8-12' },
        { key: 'protrusion', label: 'Protrusión (mm)', type: 'number', placeholder: '8-12' },
        { key: 'joint_sounds_r', label: 'Ruidos articulares derechos', type: 'select', options: ['Ninguno', 'Click apertura', 'Click cierre', 'Click recíproco', 'Crepitación'] },
        { key: 'joint_sounds_l', label: 'Ruidos articulares izquierdos', type: 'select', options: ['Ninguno', 'Click apertura', 'Click cierre', 'Click recíproco', 'Crepitación'] },
        { key: 'end_feel', label: 'Sensación final apertura', type: 'select', options: ['Normal / elástica', 'Firme', 'Dura', 'Vacía (por dolor)', 'Elástica con bloqueo'] },
      ],
    },
    {
      id: 'strength', title: 'Valoración muscular', description: 'Fuerza y control motor mandibular', hasNotes: true,
      fields: [
        { key: 'mouth_opening_strength', label: 'Fuerza apertura contra resistencia', type: 'select', options: ['Normal', 'Reducida', 'Dolorosa'] },
        { key: 'mouth_closing_strength', label: 'Fuerza cierre contra resistencia', type: 'select', options: ['Normal', 'Reducida', 'Dolorosa'] },
        { key: 'lateral_r_strength', label: 'Lateralidad derecha contra resistencia', type: 'select', options: ['Normal', 'Reducida', 'Dolorosa'] },
        { key: 'lateral_l_strength', label: 'Lateralidad izquierda contra resistencia', type: 'select', options: ['Normal', 'Reducida', 'Dolorosa'] },
        { key: 'mandibular_coordination', label: 'Coordinación mandibular', type: 'select', options: ['Buena', 'Regular', 'Mala'] },
      ],
    },
    {
      id: 'functional', title: 'Exploración funcional y escalas', description: 'Escalas funcionales y hábitos', hasNotes: true,
      fields: [
        { key: 'dc_tmd_axis', label: 'DC/TMD Eje I', type: 'select', options: ['Dolor miofascial', 'Artralgia', 'Desplazamiento disco con reducción', 'Desplazamiento disco sin reducción', 'Enfermedad degenerativa', 'Subluxación', 'Sin clasificar'], description: 'Diagnostic Criteria for TMD' },
        { key: 'jaw_functional_limitation', label: 'JFLS', type: 'number', placeholder: '0-10', description: 'Jaw Functional Limitation Scale' },
        { key: 'eva_pain', label: 'EVA Dolor', type: 'scale', description: 'Escala Visual Analógica del dolor' },
        { key: 'bruxism', label: 'Bruxismo', type: 'select', options: ['No', 'Diurno', 'Nocturno', 'Ambos'] },
        { key: 'oral_habits', label: 'Hábitos parafuncionales', type: 'multiselect', options: ['Onicofagia', 'Morder labio/mejilla', 'Mascar chicle frecuente', 'Apretamiento diurno', 'Masticación unilateral', 'Ninguno'] },
        { key: 'headache_associated', label: 'Cefalea asociada', type: 'boolean' },
        { key: 'tinnitus', label: 'Acúfenos', type: 'boolean' },
        { key: 'otalgia', label: 'Otalgia referida', type: 'boolean' },
        { key: 'functional_limitation', label: 'Limitación funcional principal', type: 'textarea', placeholder: 'Ej: masticar alimentos duros, bostezar...' },
      ],
    },
    {
      id: 'orthopedic_tests', title: 'Tests ortopédicos', description: 'Tests especiales de ATM', hasNotes: true, fields: [],
      tests: [
        { key: 'dynamic_loading', label: 'Carga dinámica', description: 'Compresión articular / dolor intracapsular' },
        { key: 'joint_distraction', label: 'Distracción articular', description: 'Alivio por tracción (causa intracapsular)' },
        { key: 'provocation_test', label: 'Test de provocación', description: 'Reproducción del dolor articular' },
        { key: 'resisted_opening', label: 'Apertura resistida', description: 'Dolor muscular (pterigoideo lateral)' },
        { key: 'resisted_closing', label: 'Cierre resistido', description: 'Dolor muscular (masetero/temporal)' },
        { key: 'lateral_pole_palpation', label: 'Palpación polo lateral ATM', description: 'Artralgia / capsulitis' },
        { key: 'posterior_palpation', label: 'Palpación retroauricular ATM', description: 'Zona retrodiscal' },
        { key: 'cervical_screening', label: 'Screening cervical', description: 'Descartar origen cervicogénico' },
      ],
    },
    {
      id: 'diagnosis', title: 'Diagnóstico diferencial', description: 'Diagnóstico y pruebas complementarias', hasNotes: true,
      fields: [
        { key: 'primary_diagnosis', label: 'Diagnóstico principal', type: 'textarea', placeholder: 'Hipótesis diagnóstica principal...' },
        { key: 'secondary_diagnosis', label: 'Diagnóstico secundario', type: 'textarea', placeholder: 'Otros diagnósticos a considerar...' },
        { key: 'complementary_tests', label: 'Pruebas complementarias solicitadas', type: 'multiselect', options: ['Ortopantomografía', 'Resonancia magnética ATM', 'TAC', 'Ninguna'] },
        { key: 'referral', label: 'Derivación', type: 'select', options: ['No necesaria', 'Odontología / Oclusión', 'Cirugía maxilofacial', 'Neurología', 'ORL', 'Psicología (gestión estrés)', 'Otro especialista'] },
        { key: 'prognosis', label: 'Pronóstico', type: 'select', options: ['Favorable', 'Moderado', 'Reservado'] },
        { key: 'estimated_sessions', label: 'Sesiones estimadas', type: 'number', placeholder: 'Ej: 8-12' },
      ],
    },
  ],
}

// ============================================
// ALL REGIONS
// ============================================
export const BODY_REGIONS: BodyRegion[] = [
  shoulderRegion,
  kneeRegion,
  spineRegion,
  hipRegion,
  ankleRegion,
  elbowRegion,
  wristRegion,
  cervicalRegion,
  tmjRegion,
]

export function getRegionById(id: string): BodyRegion | undefined {
  return BODY_REGIONS.find(r => r.id === id)
}
