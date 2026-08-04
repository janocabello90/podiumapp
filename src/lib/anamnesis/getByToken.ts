import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getAnamnesisTemplateBlocks } from '@/lib/anamnesis/template'
import type { AnamnesisBlock } from '@/components/anamnesis/anamnesisFields'

// Lectura pública de una anamnesis por token, SIN depender de RLS.
// El paciente no tiene sesión; su única credencial es el token (UUID).
// Usamos service_role (ignora RLS) y validamos el token en el servidor.
// Esto reemplaza la lectura anterior con cliente anon, que dependía de la
// policy pública `SELECT USING(TRUE)` (fuga de PII — ver Fase 0 Tarea 4).

export type ConsentTexts = {
  data_processing?: string | null
  info_treatment?: string | null
  ai_analysis?: string | null
  image_rights?: string | null
}

export type PublicAnamnesis = {
  id: string
  status: string | null
  expires_at: string | null
  form_data: Record<string, any>
  consent_data_processing: boolean
  consent_ai_analysis: boolean
  patientName: string
  consentTexts: ConsentTexts
  blocks: AnamnesisBlock[]
  audience: 'individual' | 'team'
}

export async function getAnamnesisByToken(token: string): Promise<PublicAnamnesis | null> {
  // Validación básica de forma del token (UUID) antes de tocar la DB.
  if (!token || typeof token !== 'string' || token.length < 20) {
    return null
  }

  const admin = createAdminSupabaseClient()

  const { data, error } = await admin
    .from('anamnesis_forms')
    .select('id, status, expires_at, form_data, consent_data_processing, consent_ai_analysis, clinic_id, patients(full_name, team_id)')
    .eq('token', token)
    .single()

  if (error || !data) {
    return null
  }

  // Textos vigentes de los consentimientos de la clínica (versión activa por tipo).
  const consentTexts: ConsentTexts = {}
  if (data.clinic_id) {
    const { data: versions } = await admin
      .from('consent_versions')
      .select('type, body')
      .eq('clinic_id', data.clinic_id)
      .eq('is_active', true)
    for (const v of versions || []) {
      consentTexts[(v as any).type as keyof ConsentTexts] = (v as any).body
    }
  }

  // Plantilla según el tipo de paciente: con equipo → 'team'; suelto → 'individual'.
  const audience: 'individual' | 'team' = (data.patients as any)?.team_id ? 'team' : 'individual'
  const blocks = data.clinic_id
    ? await getAnamnesisTemplateBlocks(admin, data.clinic_id, audience)
    : []

  return {
    id: data.id,
    status: data.status,
    expires_at: data.expires_at,
    form_data: (data.form_data as Record<string, any>) || {},
    consent_data_processing: !!data.consent_data_processing,
    consent_ai_analysis: !!data.consent_ai_analysis,
    patientName: (data.patients as any)?.full_name || '',
    consentTexts,
    blocks,
    audience,
  }
}
