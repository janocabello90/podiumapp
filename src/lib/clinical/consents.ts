import type { ConsentType } from '@/types/database'

// Los 3 tipos de consentimiento (Fase C) + sus etiquetas de cara al usuario.
// Fuente única, reutilizada en Ajustes, anamnesis pública y trazabilidad.
export const CONSENT_TYPES: { type: ConsentType; label: string }[] = [
  { type: 'data_processing', label: 'Protección de datos' },
  { type: 'info_treatment', label: 'Tratamiento de la información' },
  { type: 'ai_analysis', label: 'Uso de inteligencia artificial' },
  { type: 'image_rights', label: 'Derechos de imagen' },
]

// Canales de difusión para el consentimiento de derechos de imagen (según el documento
// de la clínica). Se guardan en consents.metadata = { channels: [...] } al aceptar.
export const IMAGE_CHANNELS = [
  'Web de la clínica',
  'Redes sociales',
  'Material gráfico / impreso',
  'Presentaciones y eventos',
]

export function consentLabel(type: string): string {
  return CONSENT_TYPES.find((c) => c.type === type)?.label ?? type
}
