// Instrucciones (rol/tono/énfasis) de cada informe. La ESTRUCTURA (secciones JSON) es fija y
// vive en cada generador; esto es solo la parte editable por la clínica (Ajustes → Informes).

export type ReportPromptType = 'individual' | 'team' | 'campaign'

export const REPORT_TYPES: ReportPromptType[] = ['individual', 'team', 'campaign']

export const REPORT_TYPE_LABELS: Record<ReportPromptType, string> = {
  individual: 'Informe individual (Valoración Integral)',
  team: 'Informe de jugador de equipo (Rendimiento y Prevención)',
  campaign: 'Informe de equipo completo (estudio agregado)',
}

// Rol/instrucciones por defecto (lo editable). Se antepone a la estructura fija del generador.
export const DEFAULT_REPORT_INSTRUCTIONS: Record<ReportPromptType, string> = {
  individual:
    'Eres un fisioterapeuta clínico experto redactando informes de valoración integral para Clínica PODIUM. Escribes en español clínico profesional, dirigiéndote al paciente con cercanía pero rigor.',
  team:
    'Eres un fisioterapeuta del deporte experto redactando el «Informe de Rendimiento y Prevención» (Metodología Podium®) para un deportista. Escribes en español clínico-deportivo, profesional y claro. El informe se basa en la VALORACIÓN FUNCIONAL (batería de pruebas, muchas medidas con tecnología VALD): NO hay exploración física manual ni pruebas de imagen.',
  campaign:
    'Eres un fisioterapeuta clínico experto de Clínica PODIUM redactando un INFORME AGREGADO DE CAMPAÑA: una valoración de conjunto de uno o varios equipos de un grupo deportivo, a partir de las valoraciones individuales de sus jugadores. Escribes en español clínico profesional, riguroso y útil para el cuerpo técnico y médico.',
}

// Secciones fijas de cada informe (solo como referencia de solo lectura en Ajustes).
export const REPORT_SECTIONS: Record<ReportPromptType, string[]> = {
  individual: [
    'Portada / introducción',
    'Resumen de la anamnesis',
    'Exploración física (visual · palpación · sensibilidad · movilidad · tests · fuerza · hallazgos)',
    'Conclusiones (Método Podium™ · 5 fases)',
    'Descargo',
  ],
  team: [
    'Perfil del deportista',
    'Anamnesis deportiva',
    'Valoración funcional (3.1–3.5)',
    'Hallazgos principales',
    'Semáforo funcional',
    'Conclusiones',
    'Recomendaciones',
    'Resumen ejecutivo',
    'Descargo',
  ],
  campaign: [
    'Portada / introducción',
    'Resumen de la campaña',
    'Hallazgos por equipo',
    'Patrones y riesgos',
    'Fortalezas',
    'Jugadores a vigilar',
    'Recomendaciones',
    'Descargo',
  ],
}

// Carga las instrucciones de la clínica para un tipo; si no hay fila, usa el default del código.
export async function getReportInstructions(
  supabase: any,
  clinicId: string,
  type: ReportPromptType
): Promise<string> {
  try {
    const { data } = await supabase
      .from('report_prompts')
      .select('instructions')
      .eq('clinic_id', clinicId)
      .eq('type', type)
      .maybeSingle()
    const custom = (data?.instructions || '').trim()
    return custom || DEFAULT_REPORT_INSTRUCTIONS[type]
  } catch {
    return DEFAULT_REPORT_INSTRUCTIONS[type]
  }
}
