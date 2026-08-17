-- Enlace público de alta de jugadores por equipo (autoservicio).
-- Un token por equipo (regenerable) + flag para activar/desactivar el enlace.

ALTER TABLE teams ADD COLUMN IF NOT EXISTS invite_token  UUID;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS invite_active BOOLEAN NOT NULL DEFAULT TRUE;

-- El token identifica el equipo en la ruta pública /alta/[token]; único cuando existe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_invite_token
  ON teams (invite_token)
  WHERE invite_token IS NOT NULL;
