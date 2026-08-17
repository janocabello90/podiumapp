// Formateo de fechas/horas SIEMPRE en la zona horaria de la clínica (Zaragoza).
// Necesario porque los timestamptz de Supabase van en UTC y el render en servidor
// (Vercel corre en UTC) mostraría la hora desfasada. Forzando Europe/Madrid, la
// fecha/hora sale correcta con independencia de dónde se ejecute o quién la vea.
const CLINIC_TZ = 'Europe/Madrid'

export function formatDate(
  value: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string {
  if (value == null) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { timeZone: CLINIC_TZ, ...opts })
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
): string {
  if (value == null) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('es-ES', { timeZone: CLINIC_TZ, ...opts })
}
