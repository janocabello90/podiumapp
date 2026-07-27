-- ============================================
-- Fase C — Tarea C1: consentimientos y trazabilidad
-- ============================================
-- `consent_versions`: textos versionados por tipo (gestión de la clínica).
-- `consents`: registro de cada aceptación con COPIA del texto (`version_body`)
--   para trazabilidad aunque la versión cambie después.
-- RLS clínica-scoped: `ensure_rls` deja las tablas deny-all → policies AQUÍ.
-- La escritura pública de `consents` (desde la anamnesis) va por service_role
-- (bypassa RLS) → no se abre ninguna policy pública (lección Fase 0).
-- Aplicada en prod vía MCP `apply_migration` (versión 20260727154457).
-- ============================================

CREATE TABLE IF NOT EXISTS consent_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('data_processing','info_treatment','ai_analysis')),
  version_label TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  anamnesis_id UUID REFERENCES anamnesis_forms(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('data_processing','info_treatment','ai_analysis')),
  granted BOOLEAN NOT NULL,
  version_label TEXT,
  version_body TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_versions_clinic_type ON consent_versions(clinic_id, type);
CREATE INDEX IF NOT EXISTS idx_consents_patient ON consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_consents_clinic_type ON consents(clinic_id, type);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON consent_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE consent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage clinic consent_versions" ON consent_versions;
CREATE POLICY "Users can manage clinic consent_versions" ON consent_versions
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "Users can view clinic consents" ON consents;
CREATE POLICY "Users can view clinic consents" ON consents
  FOR SELECT USING (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "Users can insert clinic consents" ON consents;
CREATE POLICY "Users can insert clinic consents" ON consents
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id());
