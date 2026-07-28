-- ============================================
-- Fase D — Tarea D2: backfill assessments → sessions (COPIAR, no mover)
-- ============================================
-- `assessments` se CONSERVA intacto (respaldo). `sessions.source_assessment_id`
-- da trazabilidad, idempotencia y permite repuntar `reports.session_id`.
-- Aplicada en prod vía MCP `apply_migration` (versión 20260728070429).
-- Verificado: nº sessions con source_assessment_id == nº assessments.
-- ============================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source_assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_source_assessment ON sessions(source_assessment_id) WHERE source_assessment_id IS NOT NULL;

INSERT INTO sessions (
  clinic_id, patient_id, physio_id, session_number, status, clinical_data, notes,
  completed_at, created_at, updated_at, source_assessment_id
)
SELECT
  a.clinic_id, a.patient_id, a.physio_id, COALESCE(a.session_number, 1),
  COALESCE(a.status, 'in_progress'), COALESCE(a.assessment_data, '{}'::jsonb), a.notes,
  CASE WHEN a.status = 'completed' THEN a.updated_at ELSE NULL END,
  a.created_at, a.updated_at, a.id
FROM assessments a
WHERE NOT EXISTS (SELECT 1 FROM sessions s WHERE s.source_assessment_id = a.id);

UPDATE reports r
SET session_id = s.id
FROM sessions s
WHERE s.source_assessment_id = r.assessment_id
  AND r.assessment_id IS NOT NULL
  AND r.session_id IS NULL;
