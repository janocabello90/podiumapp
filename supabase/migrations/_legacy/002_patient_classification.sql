-- ============================================
-- Patient clinical classification fields
-- Auto-filled by AI from anamnesis + assessment + report
-- ============================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS body_region TEXT
    CHECK (body_region IN (
      'cervical', 'dorsal', 'lumbar',
      'hombro', 'codo', 'muñeca_mano',
      'cadera', 'rodilla', 'tobillo_pie',
      'cabeza_mandibula', 'torax_costal',
      'multiple', 'otro'
    )),
  ADD COLUMN IF NOT EXISTS pathology_tag TEXT,
  ADD COLUMN IF NOT EXISTS pathology_label TEXT,
  ADD COLUMN IF NOT EXISTS activity_level TEXT
    CHECK (activity_level IN (
      'sedentario', 'ligero', 'moderado', 'intenso', 'deportista'
    )),
  ADD COLUMN IF NOT EXISTS classification_source TEXT
    CHECK (classification_source IN ('ai', 'manual', 'ai_confirmed')),
  ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;

-- Indexes for list filtering performance
CREATE INDEX IF NOT EXISTS idx_patients_body_region ON patients(body_region) WHERE body_region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_pathology_tag ON patients(pathology_tag) WHERE pathology_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_activity_level ON patients(activity_level) WHERE activity_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_clinic_status ON patients(clinic_id, status);
