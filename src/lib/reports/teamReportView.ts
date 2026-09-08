// Vista del informe de equipo: qué secciones se muestran. Compartido por el editor y el PDF
// para que la exportación respete exactamente lo que el fisio ve/elige.

export type TeamSectionKey =
  | 'kpis' | 'semaforo' | 'graficos' | 'resumen_equipo' | 'panel_metricas' | 'lesiones'
  | 'patrones_y_riesgos' | 'fortalezas' | 'grupos_de_trabajo' | 'jugadores_a_vigilar'
  | 'recomendaciones' | 'anexo'
// 'descargo' se muestra siempre (no es toggleable).

export type TeamPreset = 'cuadro_mando' | 'clinico' | 'rendimiento' | 'completo'

export const TEAM_SECTION_LABELS: Record<TeamSectionKey, string> = {
  kpis: 'KPIs de cabecera',
  semaforo: 'Semáforo de jugadores',
  graficos: 'Gráficos',
  resumen_equipo: 'Resumen del equipo',
  panel_metricas: 'Panel de métricas',
  lesiones: 'Radiografía de lesiones',
  patrones_y_riesgos: 'Patrones y riesgos',
  fortalezas: 'Fortalezas del colectivo',
  grupos_de_trabajo: 'Grupos de trabajo',
  jugadores_a_vigilar: 'Jugadores a vigilar',
  recomendaciones: 'Recomendaciones',
  anexo: 'Anexo por jugador',
}

export const TEAM_SECTION_ORDER: TeamSectionKey[] = [
  'kpis', 'semaforo', 'graficos', 'resumen_equipo', 'panel_metricas', 'lesiones',
  'patrones_y_riesgos', 'fortalezas', 'grupos_de_trabajo', 'jugadores_a_vigilar',
  'recomendaciones', 'anexo',
]

// Qué enciende cada preset.
export const TEAM_PRESETS: Record<TeamPreset, TeamSectionKey[]> = {
  cuadro_mando: ['kpis', 'semaforo', 'graficos', 'resumen_equipo', 'panel_metricas', 'grupos_de_trabajo', 'jugadores_a_vigilar', 'recomendaciones', 'anexo'],
  clinico: ['kpis', 'semaforo', 'graficos', 'lesiones', 'panel_metricas', 'patrones_y_riesgos', 'grupos_de_trabajo', 'jugadores_a_vigilar', 'recomendaciones', 'anexo'],
  rendimiento: ['kpis', 'graficos', 'resumen_equipo', 'panel_metricas', 'fortalezas', 'jugadores_a_vigilar', 'recomendaciones', 'anexo'],
  completo: [...TEAM_SECTION_ORDER],
}

export const TEAM_PRESET_LABELS: Record<TeamPreset, string> = {
  cuadro_mando: 'Cuadro de mando',
  clinico: 'Clínico-preventivo',
  rendimiento: 'Rendimiento',
  completo: 'Completo',
}

export interface TeamView {
  preset?: TeamPreset
  overrides?: Partial<Record<TeamSectionKey, boolean>> // toggles manuales sobre el preset
}

// Resuelve la visibilidad efectiva: base = preset; encima, los overrides manuales.
export function resolveVisibleSections(view: TeamView | undefined): Record<TeamSectionKey, boolean> {
  const preset = view?.preset && TEAM_PRESETS[view.preset] ? view.preset : 'cuadro_mando'
  const base = new Set(TEAM_PRESETS[preset])
  const out = {} as Record<TeamSectionKey, boolean>
  for (const k of TEAM_SECTION_ORDER) {
    const ov = view?.overrides?.[k]
    out[k] = ov === undefined ? base.has(k) : ov
  }
  return out
}
