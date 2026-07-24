-- ============================================================================
-- SHERPA — BASELINE del esquema real de producción (proyecto njzqyttrlivipnkwmbbt)
-- ============================================================================
-- Fase 0 — Tarea 2. Esta es la MIGRACIÓN INICIAL canónica: describe el estado
-- REAL desplegado de la DB (introspeccionado vía MCP, 2026-07), reconciliando
-- el drift que las antiguas 001/002 no capturaban.
--
-- Diferencias frente a las antiguas supabase/migrations/_legacy/001+002:
--   * Refleja el estado ACTUAL post-Fase0-Tarea1: NO incluye la policy pública
--     `Public can update anamnesis by token` (UPDATE), ya eliminada.
--   * Incluye la función `rls_auto_enable()` + event trigger `ensure_rls`
--     (existían en la DB pero NO en 001/002).
--   * Incluye los buckets de storage `documents` (privado) y `logos` (público),
--     creados a mano y no versionados hasta ahora.
--
-- Esta migración está marcada como YA APLICADA en supabase_migrations.schema_migrations
-- (no se ejecuta contra la DB existente). Reconstruye el esquema desde cero en
-- entornos nuevos. Idempotente donde es posible (IF NOT EXISTS / ON CONFLICT).
--
-- Las funciones get_user_clinic_id/update_updated_at se dejan SIN search_path
-- fijado, tal como están hoy en prod (endurecerlo es P2.2, fuera de alcance aquí).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================
-- FUNCIONES
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT clinic_id FROM users WHERE id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Red de seguridad: activa RLS automáticamente en toda tabla nueva de `public`.
-- OJO: no crea policies → una tabla nueva queda RLS ON + deny-all hasta añadirlas.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION rls_auto_enable();
  END IF;
END $$;

-- ============================================
-- TABLAS
-- ============================================
CREATE TABLE IF NOT EXISTS clinics (
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

CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS patients (
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Clasificación clínica (antigua migración 002)
  body_region TEXT CHECK (body_region IN (
    'cervical', 'dorsal', 'lumbar', 'hombro', 'codo', 'muñeca_mano',
    'cadera', 'rodilla', 'tobillo_pie', 'cabeza_mandibula', 'torax_costal',
    'multiple', 'otro')),
  pathology_tag TEXT,
  pathology_label TEXT,
  activity_level TEXT CHECK (activity_level IN (
    'sedentario', 'ligero', 'moderado', 'intenso', 'deportista')),
  classification_source TEXT CHECK (classification_source IN ('ai', 'manual', 'ai_confirmed')),
  classification_confidence NUMERIC(3,2),
  classified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS anamnesis_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  form_data JSONB DEFAULT '{}',
  consent_data_processing BOOLEAN DEFAULT FALSE,
  consent_ai_analysis BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  physio_id UUID NOT NULL REFERENCES users(id),
  session_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  assessment_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audio_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  transcription TEXT,
  transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
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

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'draft', 'approved', 'delivered')),
  anamnesis_id UUID REFERENCES anamnesis_forms(id),
  assessment_id UUID REFERENCES assessments(id),
  report_data JSONB DEFAULT '{}',
  pdf_storage_path TEXT,
  ai_model TEXT,
  ai_prompt_tokens INTEGER,
  ai_completion_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES (los no derivados de PK/UNIQUE)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_anamnesis_token ON anamnesis_forms(token);
CREATE INDEX IF NOT EXISTS idx_anamnesis_patient ON anamnesis_forms(patient_id);
CREATE INDEX IF NOT EXISTS idx_anamnesis_status ON anamnesis_forms(status);
CREATE INDEX IF NOT EXISTS idx_assessments_patient ON assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_body_region ON patients(body_region) WHERE body_region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_pathology_tag ON patients(pathology_tag) WHERE pathology_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_activity_level ON patients(activity_level) WHERE activity_level IS NOT NULL;

-- ============================================
-- TRIGGERS updated_at (solo en las tablas que lo tienen en prod)
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON anamnesis_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnesis_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- clinics
CREATE POLICY "Users can view own clinic" ON clinics
  FOR SELECT USING (id = get_user_clinic_id());

-- users
CREATE POLICY "Users can view clinic colleagues" ON users
  FOR SELECT USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- patients
CREATE POLICY "Users can view clinic patients" ON patients
  FOR SELECT USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Users can create patients" ON patients
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Users can update clinic patients" ON patients
  FOR UPDATE USING (clinic_id = get_user_clinic_id());

-- anamnesis_forms  (NOTA: la policy pública de UPDATE fue eliminada en Fase 0
-- Tarea 1; la de SELECT pública SIGUE presente y es load-bearing para la página
-- pública /anamnesis/[token] hasta migrar esa lectura a service_role.)
CREATE POLICY "Users can view clinic anamnesis" ON anamnesis_forms
  FOR SELECT USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Users can create anamnesis" ON anamnesis_forms
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY "Users can update clinic anamnesis" ON anamnesis_forms
  FOR UPDATE USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Public can view anamnesis by token" ON anamnesis_forms
  FOR SELECT USING (TRUE);  -- Token validation happens in the app (pendiente P0.1)

-- assessments / audio / documents / reports
CREATE POLICY "Users can manage clinic assessments" ON assessments
  FOR ALL USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Users can manage clinic audio" ON audio_recordings
  FOR ALL USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Users can manage clinic documents" ON documents
  FOR ALL USING (clinic_id = get_user_clinic_id());
CREATE POLICY "Users can manage clinic reports" ON reports
  FOR ALL USING (clinic_id = get_user_clinic_id());

-- ============================================
-- STORAGE BUCKETS (creados a mano en prod; versionados aquí)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('documents', 'documents', FALSE, 52428800,
    ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('logos', 'logos', TRUE, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SEED: Clínica Podium
-- ============================================
INSERT INTO clinics (id, name, slug, phone, email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Clínica Podium',
  'podium',
  '+34 XXX XXX XXX',
  'info@clinicapodium.com'
)
ON CONFLICT (id) DO NOTHING;
