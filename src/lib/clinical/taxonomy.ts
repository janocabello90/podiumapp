// Controlled vocabulary for patient clinical classification.
// The AI classifier MUST pick from these exact slugs.

export const BODY_REGIONS = [
  { slug: 'cervical', label: 'Cervical' },
  { slug: 'dorsal', label: 'Dorsal' },
  { slug: 'lumbar', label: 'Lumbar' },
  { slug: 'hombro', label: 'Hombro' },
  { slug: 'codo', label: 'Codo' },
  { slug: 'muñeca_mano', label: 'Muñeca / Mano' },
  { slug: 'cadera', label: 'Cadera' },
  { slug: 'rodilla', label: 'Rodilla' },
  { slug: 'tobillo_pie', label: 'Tobillo / Pie' },
  { slug: 'cabeza_mandibula', label: 'Cabeza / Mandíbula' },
  { slug: 'torax_costal', label: 'Tórax / Costal' },
  { slug: 'multiple', label: 'Múltiple' },
  { slug: 'otro', label: 'Otro' },
] as const

export type BodyRegionSlug = (typeof BODY_REGIONS)[number]['slug']

export const ACTIVITY_LEVELS = [
  { slug: 'sedentario', label: 'Sedentario', description: 'Sin deporte + trabajo sedentario' },
  { slug: 'ligero', label: 'Ligero', description: '<150 min/sem actividad moderada' },
  { slug: 'moderado', label: 'Moderado', description: '150-300 min/sem, deporte recreativo' },
  { slug: 'intenso', label: 'Intenso', description: '>300 min/sem, deporte regular' },
  { slug: 'deportista', label: 'Deportista', description: 'Competición o entrenamiento estructurado' },
] as const

export type ActivityLevelSlug = (typeof ACTIVITY_LEVELS)[number]['slug']

// Catálogo inicial de patologías frecuentes en fisio musculoesquelética.
// El AI clasificador elige de aquí; si nada encaja devuelve 'otro' + descripción libre en pathology_label.
export const PATHOLOGIES: Array<{ slug: string; label: string; region: BodyRegionSlug }> = [
  // Hombro
  { slug: 'sindrome_subacromial', label: 'Síndrome subacromial', region: 'hombro' },
  { slug: 'tendinopatia_manguito', label: 'Tendinopatía del manguito rotador', region: 'hombro' },
  { slug: 'capsulitis_adhesiva', label: 'Capsulitis adhesiva (hombro congelado)', region: 'hombro' },
  { slug: 'inestabilidad_glenohumeral', label: 'Inestabilidad glenohumeral', region: 'hombro' },
  { slug: 'lesion_slap', label: 'Lesión SLAP / labrum', region: 'hombro' },
  { slug: 'rotura_manguito', label: 'Rotura del manguito rotador', region: 'hombro' },
  { slug: 'luxacion_acromioclavicular', label: 'Luxación acromioclavicular', region: 'hombro' },

  // Codo
  { slug: 'epicondilitis', label: 'Epicondilitis (codo de tenista)', region: 'codo' },
  { slug: 'epitrocleitis', label: 'Epitrocleitis (codo de golfista)', region: 'codo' },
  { slug: 'bursitis_olecraniana', label: 'Bursitis olecraniana', region: 'codo' },

  // Muñeca / mano
  { slug: 'tunel_carpiano', label: 'Síndrome del túnel carpiano', region: 'muñeca_mano' },
  { slug: 'tenosinovitis_quervain', label: 'Tenosinovitis de De Quervain', region: 'muñeca_mano' },
  { slug: 'dedo_gatillo', label: 'Dedo en gatillo', region: 'muñeca_mano' },
  { slug: 'rizartrosis', label: 'Rizartrosis', region: 'muñeca_mano' },

  // Cervical
  { slug: 'cervicalgia_mecanica', label: 'Cervicalgia mecánica', region: 'cervical' },
  { slug: 'cervicobraquialgia', label: 'Cervicobraquialgia', region: 'cervical' },
  { slug: 'hernia_cervical', label: 'Hernia discal cervical', region: 'cervical' },
  { slug: 'latigazo_cervical', label: 'Esguince cervical / latigazo', region: 'cervical' },
  { slug: 'cefalea_tensional', label: 'Cefalea tensional', region: 'cervical' },

  // Dorsal
  { slug: 'dorsalgia_mecanica', label: 'Dorsalgia mecánica', region: 'dorsal' },
  { slug: 'disfuncion_costovertebral', label: 'Disfunción costovertebral', region: 'dorsal' },

  // Lumbar
  { slug: 'lumbalgia_mecanica', label: 'Lumbalgia mecánica', region: 'lumbar' },
  { slug: 'lumbalgia_inespecifica', label: 'Lumbalgia inespecífica', region: 'lumbar' },
  { slug: 'ciatica', label: 'Ciática / lumbociatalgia', region: 'lumbar' },
  { slug: 'hernia_lumbar', label: 'Hernia discal lumbar', region: 'lumbar' },
  { slug: 'estenosis_canal', label: 'Estenosis del canal lumbar', region: 'lumbar' },
  { slug: 'sindrome_facetario', label: 'Síndrome facetario', region: 'lumbar' },
  { slug: 'espondilolistesis', label: 'Espondilolistesis', region: 'lumbar' },
  { slug: 'sacroileitis', label: 'Sacroileítis / disfunción SI', region: 'lumbar' },

  // Cadera
  { slug: 'sindrome_glutea', label: 'Síndrome glúteo / tendinopatía glútea', region: 'cadera' },
  { slug: 'pinzamiento_femoroacetabular', label: 'Pinzamiento femoroacetabular', region: 'cadera' },
  { slug: 'artrosis_cadera', label: 'Artrosis de cadera', region: 'cadera' },
  { slug: 'bursitis_trocanterea', label: 'Bursitis trocantérea', region: 'cadera' },
  { slug: 'sindrome_piramidal', label: 'Síndrome piramidal', region: 'cadera' },
  { slug: 'pubalgia', label: 'Pubalgia', region: 'cadera' },

  // Rodilla
  { slug: 'tendinopatia_rotuliana', label: 'Tendinopatía rotuliana', region: 'rodilla' },
  { slug: 'sindrome_femoropatelar', label: 'Síndrome femoropatelar', region: 'rodilla' },
  { slug: 'condropatia_rotuliana', label: 'Condropatía rotuliana', region: 'rodilla' },
  { slug: 'rotura_menisco', label: 'Rotura meniscal', region: 'rodilla' },
  { slug: 'lesion_lca', label: 'Lesión de LCA', region: 'rodilla' },
  { slug: 'lesion_lcp', label: 'Lesión de LCP', region: 'rodilla' },
  { slug: 'lesion_lcm_lcl', label: 'Lesión ligamento colateral', region: 'rodilla' },
  { slug: 'sindrome_cintilla', label: 'Síndrome de la cintilla iliotibial', region: 'rodilla' },
  { slug: 'artrosis_rodilla', label: 'Artrosis de rodilla (gonartrosis)', region: 'rodilla' },
  { slug: 'tendinopatia_pata_ganso', label: 'Tendinopatía pata de ganso', region: 'rodilla' },

  // Tobillo / pie
  { slug: 'esguince_tobillo', label: 'Esguince de tobillo', region: 'tobillo_pie' },
  { slug: 'tendinopatia_aquilea', label: 'Tendinopatía aquílea', region: 'tobillo_pie' },
  { slug: 'fascitis_plantar', label: 'Fascitis plantar', region: 'tobillo_pie' },
  { slug: 'fractura_estres_tibia', label: 'Fractura por estrés (tibia/pie)', region: 'tobillo_pie' },
  { slug: 'hallux_valgus', label: 'Hallux valgus', region: 'tobillo_pie' },
  { slug: 'neuroma_morton', label: 'Neuroma de Morton', region: 'tobillo_pie' },

  // Generales
  { slug: 'post_quirurgico', label: 'Post-quirúrgico / rehabilitación', region: 'multiple' },
  { slug: 'dolor_cronico_generalizado', label: 'Dolor crónico generalizado', region: 'multiple' },
  { slug: 'disfuncion_atm', label: 'Disfunción ATM', region: 'cabeza_mandibula' },
  { slug: 'otro', label: 'Otro (ver descripción)', region: 'otro' },
]

export function getPathologiesForRegion(region: BodyRegionSlug) {
  return PATHOLOGIES.filter((p) => p.region === region || p.region === 'multiple' || p.region === 'otro')
}

export function getPathologyLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return PATHOLOGIES.find((p) => p.slug === slug)?.label ?? null
}

export function getRegionLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return BODY_REGIONS.find((r) => r.slug === slug)?.label ?? null
}

export function getActivityLabel(slug: string | null | undefined): string | null {
  if (!slug) return null
  return ACTIVITY_LEVELS.find((a) => a.slug === slug)?.label ?? null
}
