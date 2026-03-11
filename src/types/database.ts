// ============================================
// Database Types - Generated from schema
// ============================================

export type UserRole = 'admin' | 'physio'
export type PatientStatus = 'active' | 'inactive' | 'archived'
export type AnamnesisStatus = 'pending' | 'in_progress' | 'completed' | 'expired'
export type AssessmentStatus = 'in_progress' | 'completed'
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type DocType = 'vald_report' | 'medical_image' | 'external_report' | 'other'
export type ReportStatus = 'generating' | 'draft' | 'approved' | 'delivered'

export interface Clinic {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  clinic_id: string
  full_name: string
  email: string
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  clinic_id: string
  created_by: string | null
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: 'male' | 'female' | 'other' | null
  notes: string | null
  status: PatientStatus
  created_at: string
  updated_at: string
}

export interface AnamnesisForm {
  id: string
  patient_id: string
  clinic_id: string
  token: string
  status: AnamnesisStatus
  form_data: Record<string, any>
  consent_data_processing: boolean
  consent_ai_analysis: boolean
  consent_timestamp: string | null
  started_at: string | null
  completed_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export interface Assessment {
  id: string
  patient_id: string
  clinic_id: string
  physio_id: string
  session_number: number
  status: AssessmentStatus
  assessment_data: Record<string, any>
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AudioRecording {
  id: string
  assessment_id: string
  clinic_id: string
  storage_path: string
  duration_seconds: number | null
  transcription: string | null
  transcription_status: TranscriptionStatus
  created_at: string
}

export interface Document {
  id: string
  patient_id: string
  clinic_id: string
  uploaded_by: string | null
  doc_type: DocType
  file_name: string
  storage_path: string
  extracted_data: Record<string, any> | null
  extraction_status: string
  created_at: string
}

export interface Report {
  id: string
  patient_id: string
  clinic_id: string
  generated_by: string | null
  status: ReportStatus
  anamnesis_id: string | null
  assessment_id: string | null
  report_data: Record<string, any>
  pdf_storage_path: string | null
  ai_model: string | null
  ai_prompt_tokens: number | null
  ai_completion_tokens: number | null
  created_at: string
  updated_at: string
}
