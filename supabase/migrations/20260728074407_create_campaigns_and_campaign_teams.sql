-- ============================================
-- Fase E — Tarea E1: campañas (estudio de valoración de un grupo/equipos)
-- ============================================
-- `campaigns`: estudio de un grupo, con inicio/fin previsto y nº de seguimientos.
-- `campaign_teams`: subconjunto de equipos del grupo incluidos en la campaña.
-- `sessions.campaign_id` NULLABLE → agrupa las sesiones del estudio; null = individual.
-- RLS clínica-scoped: `ensure_rls` deja las tablas deny-all → policies AQUÍ.
-- Aplicada en prod vía MCP `apply_migration` (versión 20260728074407).
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','closed')),
  start_date DATE,
  end_date_planned DATE,
  planned_consultations INTEGER,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, team_id)
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_group ON campaigns(group_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_clinic ON campaigns(clinic_id);
CREATE INDEX IF NOT EXISTS idx_campaign_teams_campaign ON campaign_teams(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_teams_team ON campaign_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_campaign ON sessions(campaign_id) WHERE campaign_id IS NOT NULL;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage clinic campaigns" ON campaigns;
CREATE POLICY "Users can manage clinic campaigns" ON campaigns
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());

DROP POLICY IF EXISTS "Users can manage clinic campaign_teams" ON campaign_teams;
CREATE POLICY "Users can manage clinic campaign_teams" ON campaign_teams
  FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
