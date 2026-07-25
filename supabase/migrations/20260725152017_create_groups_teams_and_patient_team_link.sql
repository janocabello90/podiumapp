-- ============================================
-- Fase A — Tarea A1: capa organizativa (grupos/equipos) + vínculo jugador→equipo
-- ============================================
-- Aditivo. `patients.team_id` NULLABLE → el flujo individual NO cambia (team_id NULL).
-- RLS clínica-scoped en las tablas nuevas: el event trigger `ensure_rls` las deja
-- RLS-ON pero deny-all sin policies, así que las policies se crean AQUÍ.
-- Aplicada en prod vía MCP `apply_migration` (versión 20260725152017).
-- `sport_id` NO va aquí — se añade en Fase B.
-- ============================================

-- === Tablas ===
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === Vínculo jugador→equipo (NULLABLE, ON DELETE SET NULL) ===
ALTER TABLE patients ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- === Índices ===
CREATE INDEX IF NOT EXISTS idx_groups_clinic ON groups(clinic_id);
CREATE INDEX IF NOT EXISTS idx_teams_clinic ON teams(clinic_id);
CREATE INDEX IF NOT EXISTS idx_teams_group ON teams(group_id);
CREATE INDEX IF NOT EXISTS idx_patients_team ON patients(team_id) WHERE team_id IS NOT NULL;

-- === Triggers updated_at ===
CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === RLS + policies clínica-scoped ===
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage clinic groups" ON groups;
CREATE POLICY "Users can manage clinic groups" ON groups
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "Users can manage clinic teams" ON teams;
CREATE POLICY "Users can manage clinic teams" ON teams
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
