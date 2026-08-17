-- Informe de equipo por (equipo, ronda): añade team_id + campaign_round a reports,
-- y campaign_round a sessions (la ronda de la valoración dentro del estudio).
-- Aditivo y NULLABLE (los informes/sesiones existentes no se ven afectados).

ALTER TABLE reports  ADD COLUMN IF NOT EXISTS team_id       UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE reports  ADD COLUMN IF NOT EXISTS campaign_round INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS campaign_round INTEGER;

-- Búsqueda del último informe de equipo por (estudio, equipo, ronda).
CREATE INDEX IF NOT EXISTS idx_reports_campaign_team_round
  ON reports (campaign_id, team_id, campaign_round)
  WHERE scope = 'campaign';
