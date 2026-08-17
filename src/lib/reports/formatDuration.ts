// Formatea una duración en ms a "X min Y s" (o "Y s" si es menos de un minuto).
// Devuelve null si no hay dato, para poder ocultar el registro cuando no aplica.
export function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min === 0 ? `${sec} s` : `${min} min ${sec} s`
}
