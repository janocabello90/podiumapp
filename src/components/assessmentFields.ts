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
    // 2. Valoración de la sensibilidad
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
// ALL REGIONS
// ============================================
export const BODY_REGIONS: BodyRegion[] = [
  shoulderRegion,
  kneeRegion,
  spineRegion,
]

export function getRegionById(id: string): BodyRegion | undefined {
  return BODY_REGIONS.find(r => r.id === id)
}
