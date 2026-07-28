-- ============================================
-- Fase D — Tarea D1: entidad Sesión (+ pruebas por sesión) + vínculo informe→sesión
-- ============================================
-- Aditivo. `sessions.clinical_data` absorberá la exploración de 84 campos.
-- `session_tests` = pruebas realizadas en la sesión, con NOTAS por prueba y
--   snapshot `test_name` (sobrevive si se borra la prueba del catálogo → test_id SET NULL).
-- NO toca `assessments` (se conserva como respaldo; backfill copia-no-mueve en D2).
-- RLS clínica-scoped: `ensure_rls` deja las tablas deny-all → policies AQUÍ.
-- Aplicada en prod vía MCP `apply_migration` (versión 20260727183513).
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  physio_id UUID NOT NULL REFERENCES users(id),
  sport_id UUID REFERENCES sports(id) ON DELETE SET NULL,
  session_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  clinical_data JSONB DEFAULT '{}',
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  test_id UUID REFERENCES tests(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  notes TEXT,
  result_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_clinic ON sessions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_session_tests_session ON session_tests(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id) WHERE session_id IS NOT NULL;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON session_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage clinic sessions" ON sessions;
CREATE POLICY "Users can manage clinic sessions" ON sessions
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "Users can manage clinic session_tests" ON session_tests;
CREATE POLICY "Users can manage clinic session_tests" ON session_tests
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
