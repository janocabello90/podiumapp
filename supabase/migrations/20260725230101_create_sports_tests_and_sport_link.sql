-- ============================================
-- Fase B — Tarea B1: catálogos de deportes y pruebas + relación deporte→pruebas
-- ============================================
-- Aditivo. `teams.sport_id` / `patients.sport_id` NULLABLE. SIN efecto en runtime
-- todavía (el deporte no dirige ninguna valoración hasta la Fase D).
-- RLS clínica-scoped en las tablas nuevas: `ensure_rls` las deja RLS-ON pero
-- deny-all sin policies, así que las policies se crean AQUÍ.
-- Aplicada en prod vía MCP `apply_migration` (versión 20260725230101).
-- ============================================

-- === Tablas ===
CREATE TABLE IF NOT EXISTS sports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (clinic_id, name)
);

CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  vald_interpretation_prompt TEXT,   -- prompt por prueba (cómo interpretar VALD)
  result_schema JSONB,               -- reservado para resultados estructurados (Fase D+)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (clinic_id, name)
);

CREATE TABLE IF NOT EXISTS sport_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sport_id, test_id)
);

-- === Extensiones (deporte por defecto en equipo / override en paciente) ===
ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES sports(id) ON DELETE SET NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES sports(id) ON DELETE SET NULL;

-- === Índices ===
CREATE INDEX IF NOT EXISTS idx_sports_clinic ON sports(clinic_id);
CREATE INDEX IF NOT EXISTS idx_tests_clinic ON tests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_sport_tests_sport ON sport_tests(sport_id);
CREATE INDEX IF NOT EXISTS idx_sport_tests_test ON sport_tests(test_id);
CREATE INDEX IF NOT EXISTS idx_teams_sport ON teams(sport_id) WHERE sport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_sport ON patients(sport_id) WHERE sport_id IS NOT NULL;

-- === Triggers updated_at ===
CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON sports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON tests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === RLS + policies clínica-scoped ===
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sport_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage clinic sports" ON sports;
CREATE POLICY "Users can manage clinic sports" ON sports
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "Users can manage clinic tests" ON tests;
CREATE POLICY "Users can manage clinic tests" ON tests
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "Users can manage clinic sport_tests" ON sport_tests;
CREATE POLICY "Users can manage clinic sport_tests" ON sport_tests
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
