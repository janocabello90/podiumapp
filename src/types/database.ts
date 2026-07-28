// ============================================================================
// Alias de dominio de la app.
// El esquema COMPLETO y autoritativo vive en ./database.generated.ts, generado
// automáticamente desde Supabase (MCP generate_typescript_types). Al regenerarlo,
// los nombres de columna y las columnas nuevas se propagan aquí solos (vía los
// `Omit`/derivaciones de abajo, que fallarían en compilación si una columna
// desaparece — señal para actualizar).
//
// Lo único que se mantiene a mano aquí son overrides deliberados sobre el tipo
// generado, porque el generador de Supabase:
//   (a) tipa como `string` las columnas con CHECK (perdemos las uniones), y
//   (b) marca como nullable toda columna con DEFAULT (created_at, status, etc.),
//       aunque en la práctica SIEMPRE tienen valor en las lecturas de la app.
// Estos overrides reflejan los DEFAULT/CHECK reales de la DB y preservan el
// contrato no-nulo con el que está escrita la app.
// ============================================================================

import type { Database } from './database.generated'

export type { Database, Json } from './database.generated'

type T = Database['public']['Tables']

// --- Enums de dominio (espejo de los CHECK constraints de la DB) ---
export type UserRole = 'admin' | 'physio'
export type PatientStatus = 'active' | 'inactive' | 'archived'
export type AnamnesisStatus = 'pending' | 'in_progress' | 'completed' | 'expired'
export type AssessmentStatus = 'in_progress' | 'completed'
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type DocType = 'vald_report' | 'medical_image' | 'external_report' | 'other'
export type ReportStatus = 'generating' | 'draft' | 'approved' | 'delivered'

// --- Row shapes derivados del esquema real (con overrides no-nulos/enum) ---

export type Clinic = Omit<T['clinics']['Row'], 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
}

// Capa organizativa deportiva (Fase A). `patients.team_id` (nullable) llega
// automáticamente al tipo `Patient` de abajo por derivación del Row.
export type Group = Omit<T['groups']['Row'], 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
}

export type Team = Omit<T['teams']['Row'], 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
}

// Catálogos de deportes y pruebas (Fase B). `teams.sport_id` / `patients.sport_id`
// (nullable) llegan solos a `Team` / `Patient` por derivación del Row.
export type Sport = Omit<T['sports']['Row'], 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
}

export type Test = Omit<T['tests']['Row'], 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
}

export type SportTest = Omit<T['sport_tests']['Row'], 'created_at'> & {
  created_at: string
}

// Consentimientos y trazabilidad (Fase C).
export type ConsentVersion = Omit<T['consent_versions']['Row'], 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
}

export type ConsentType = 'data_processing' | 'info_treatment' | 'ai_analysis'

export type Consent = Omit<T['consents']['Row'], 'created_at' | 'granted_at'> & {
  created_at: string
  granted_at: string
}

// Entidad Sesión (Fase D). `clinical_data` (los 84 campos) se narrow a Record.
export type Session = Omit<T['sessions']['Row'], 'clinical_data' | 'created_at' | 'updated_at'> & {
  clinical_data: Record<string, any>
  created_at: string
  updated_at: string
}

export type SessionTest = Omit<T['session_tests']['Row'], 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
}

// Campañas (Fase E). `sessions.campaign_id` (nullable) llega solo a `Session`.
export type Campaign = Omit<T['campaigns']['Row'], 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
}

export type CampaignTeam = Omit<T['campaign_teams']['Row'], 'created_at'> & {
  created_at: string
}

export type User = Omit<T['users']['Row'], 'role' | 'is_active' | 'created_at' | 'updated_at'> & {
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Patient = Omit<
  T['patients']['Row'],
  'gender' | 'status' | 'created_at' | 'updated_at'
> & {
  gender: 'male' | 'female' | 'other' | null
  status: PatientStatus
  created_at: string
  updated_at: string
}

export type AnamnesisForm = Omit<
  T['anamnesis_forms']['Row'],
  'status' | 'form_data' | 'consent_data_processing' | 'consent_ai_analysis' | 'expires_at' | 'created_at' | 'updated_at'
> & {
  status: AnamnesisStatus
  form_data: Record<string, any>
  consent_data_processing: boolean
  consent_ai_analysis: boolean
  expires_at: string
  created_at: string
  updated_at: string
}

export type Assessment = Omit<
  T['assessments']['Row'],
  'session_number' | 'status' | 'assessment_data' | 'created_at' | 'updated_at'
> & {
  session_number: number
  status: AssessmentStatus
  assessment_data: Record<string, any>
  created_at: string
  updated_at: string
}

export type AudioRecording = Omit<
  T['audio_recordings']['Row'],
  'transcription_status' | 'created_at'
> & {
  transcription_status: TranscriptionStatus
  created_at: string
}

export type Document = Omit<
  T['documents']['Row'],
  'doc_type' | 'extracted_data' | 'extraction_status' | 'created_at'
> & {
  doc_type: DocType
  extracted_data: Record<string, any> | null
  extraction_status: string
  created_at: string
}

export type Report = Omit<
  T['reports']['Row'],
  'status' | 'report_data' | 'created_at' | 'updated_at'
> & {
  status: ReportStatus
  report_data: Record<string, any>
  created_at: string
  updated_at: string
}
