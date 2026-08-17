-- Generación de informes en segundo plano: el estado 'generating' ya existía;
-- se añade 'error' para marcar una generación fallida (o atascada) sin perder la fila.

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;

ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (
  status IN ('generating', 'draft', 'approved', 'delivered', 'error')
);
