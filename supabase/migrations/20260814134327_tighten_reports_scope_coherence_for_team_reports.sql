-- Endurece la coherencia de scope de reports para informes de equipo:
-- individual  ⇒ patient_id NOT NULL
-- campaign    ⇒ campaign_id + team_id + campaign_round NOT NULL
-- (Seguro: no había informes de campaña previos que violaran el CHECK.)

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_scope_coherence_check;

ALTER TABLE reports ADD CONSTRAINT reports_scope_coherence_check CHECK (
  (scope = 'individual' AND patient_id IS NOT NULL)
  OR (scope = 'campaign' AND campaign_id IS NOT NULL AND team_id IS NOT NULL AND campaign_round IS NOT NULL)
);
