import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// Lectura pública de una anamnesis por token, SIN depender de RLS.
// El paciente no tiene sesión; su única credencial es el token (UUID).
// Usamos service_role (ignora RLS) y validamos el token en el servidor.
// Esto reemplaza la lectura anterior con cliente anon, que dependía de la
// policy pública `SELECT USING(TRUE)` (fuga de PII — ver Fase 0 Tarea 4).

export type PublicAnamnesis = {
  id: string
  status: string | null
  expires_at: string | null
  form_data: Record<string, any>
  consent_data_processing: boolean
  consent_ai_analysis: boolean
  patientName: string
}

export async function getAnamnesisByToken(token: string): Promise<PublicAnamnesis | null> {
  // Validación básica de forma del token (UUID) antes de tocar la DB.
  if (!token || typeof token !== 'string' || token.length < 20) {
    return null
  }

  const admin = createAdminSupabaseClient()

  const { data, error } = await admin
    .from('anamnesis_forms')
    .select('id, status, expires_at, form_data, consent_data_processing, consent_ai_analysis, patients(full_name)')
    .eq('token', token)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    status: data.status,
    expires_at: data.expires_at,
    form_data: (data.form_data as Record<string, any>) || {},
    consent_data_processing: !!data.consent_data_processing,
    consent_ai_analysis: !!data.consent_ai_analysis,
    patientName: (data.patients as any)?.full_name || '',
  }
}
