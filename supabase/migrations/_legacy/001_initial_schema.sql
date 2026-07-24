-- ============================================
-- PODIUM APP - Initial Database Schema
-- Phase 1: Auth, Patients, Anamnesis
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CLINICS
-- ============================================
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS (Physios / Admins)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'physio' CHECK (role IN ('admin', 'physio')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PATIENTS
-- ============================================
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANAMNESIS FORMS
-- ============================================
CREATE TABLE anamnesis_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  -- All form data stored as JSONB (flexible for 94+ fields)
  form_data JSONB DEFAULT '{}',
  -- Consent tracking
  consent_data_processing BOOLEAN DEFAULT FALSE,
  consent_ai_analysis BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  -- Metadata
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSESSMENTS (Physio session data)
-- ============================================
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  physio_id UUID NOT NULL REFERENCES users(id),
  session_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  -- Structured assessment data (inspection, palpation, mobility, etc.)
  assessment_data JSONB DEFAULT '{}',
  -- Physio notes (from audio transcription or manual)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIO RECORDINGS
-- ============================================
CREATE TABLE audio_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  transcription TEXT,
  transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS (VALD PDFs, etc.)
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('vald_report', 'medical_image', 'external_report', 'other')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_data JSONB,
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPORTS (AI-generated final reports)
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'draft', 'approved', 'delivered')),
  -- Source references
  anamnesis_id UUID REFERENCES anamnesis_forms(id),
  assessment_id UUID REFERENCES assessments(id),
  -- Report content
  report_data JSONB DEFAULT '{}',
  pdf_storage_path TEXT,
  -- AI metadata
  ai_model TEXT,
  ai_prompt_tokens INTEGER,
  ai_completion_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_users_clinic ON users(clinic_id);
CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_patients_name ON patients(full_name);
CREATE INDEX idx_anamnesis_token ON anamnesis_forms(token);
CREATE INDEX idx_anamnesis_patient ON anamnesis_forms(patient_id);
CREATE INDEX idx_anamnesis_status ON anamnesis_forms(status);
CREATE INDEX idx_assessments_patient ON assessments(patient_id);
CREATE INDEX idx_documents_patient ON documents(patient_id);
CREATE INDEX idx_reports_patient ON reports(patient_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnesis_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's clinic_id
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- CLINICS: users can only see their own clinic
CREATE POLICY "Users can view own clinic" ON clinics
  FOR SELECT USING (id = get_user_clinic_id());

-- USERS: users can see colleagues in same clinic
CREATE POLICY "Users can view clinic colleagues" ON users
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- PATIENTS: clinic-scoped access
CREATE POLICY "Users can view clinic patients" ON patients
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Users can create patients" ON patients
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Users can update clinic patients" ON patients
  FOR UPDATE USING (clinic_id = get_user_clinic_id());

-- ANAMNESIS: clinic-scoped + public token access for patients
CREATE POLICY "Users can view clinic anamnesis" ON anamnesis_forms
  FOR SELECT USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Users can create anamnesis" ON anamnesis_forms
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());

CREATE POLICY "Users can update clinic anamnesis" ON anamnesis_forms
  FOR UPDATE USING (clinic_id = get_user_clinic_id());

-- Public access for anamnesis form via token (no auth required)
CREATE POLICY "Public can view anamnesis by token" ON anamnesis_forms
  FOR SELECT USING (TRUE);  -- Token validation happens in the app

CREATE POLICY "Public can update anamnesis by token" ON anamnesis_forms
  FOR UPDATE USING (TRUE);  -- Token validation happens in the app

-- ASSESSMENTS: clinic-scoped
CREATE POLICY "Users can manage clinic assessments" ON assessments
  FOR ALL USING (clinic_id = get_user_clinic_id());

-- AUDIO: clinic-scoped
CREATE POLICY "Users can manage clinic audio" ON audio_recordings
  FOR ALL USING (clinic_id = get_user_clinic_id());

-- DOCUMENTS: clinic-scoped
CREATE POLICY "Users can manage clinic documents" ON documents
  FOR ALL USING (clinic_id = get_user_clinic_id());

-- REPORTS: clinic-scoped
CREATE POLICY "Users can manage clinic reports" ON reports
  FOR ALL USING (clinic_id = get_user_clinic_id());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON anamnesis_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA: Clínica Podium
-- ============================================
INSERT INTO clinics (id, name, slug, phone, email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Clínica Podium',
  'podium',
  '+34 XXX XXX XXX',
  'info@clinicapodium.com'
);
