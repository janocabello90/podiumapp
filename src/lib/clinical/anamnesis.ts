// Estado de caducidad de una anamnesis.
//
// La caducidad NO se persiste como status='expired' en la BD: el enlace tiene un
// `expires_at` (por defecto creación + 14 días) y el estado "expirada" se deriva
// comparando esa fecha con el momento actual. Este helper unifica ese cálculo para
// que la UI del fisio (ficha, lista, panel, etapa) coincida con lo que ve el paciente
// en la página pública.

export type AnamnesisLike =
  | { status?: string | null; expires_at?: string | null }
  | null
  | undefined

/** true si la anamnesis existe, no está completada y su fecha de expiración ya pasó
 *  (o quedó marcada explícitamente como 'expired'). */
export function isAnamnesisExpired(form: AnamnesisLike): boolean {
  if (!form) return false
  if (form.status === 'completed') return false
  if (form.status === 'expired') return true
  return !!form.expires_at && new Date(form.expires_at).getTime() < Date.now()
}
