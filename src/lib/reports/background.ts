import { waitUntil } from '@vercel/functions'
import { createClient } from '@supabase/supabase-js'

// Generación de informes en SEGUNDO PLANO.
// - runReportInBackground: ejecuta el trabajo pesado (contexto + IA + guardado) tras responder,
//   vía waitUntil; si lanza, marca la fila reports como 'error' con el motivo.
// - Guard de concurrencia + detección de "atascado" para no dejar filas colgadas en 'generating'.

// Si una fila lleva 'generating' más de esto, se considera atascada (> maxDuration de la función).
export const GENERATION_STALE_MINUTES = 15

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Ejecuta `work` en segundo plano. La ruta debe llamar a esto SIN await y devolver 202 a continuación.
// El trabajo se encarga de poner la fila en 'draft' al terminar; aquí solo capturamos el fallo → 'error'.
export function runReportInBackground(reportId: string, work: () => Promise<void>) {
  waitUntil(
    (async () => {
      try {
        await work()
      } catch (e: any) {
        console.error('Background report generation failed:', e?.message)
        try {
          await admin()
            .from('reports')
            .update({ status: 'error', report_data: { _error: e?.message || 'Error al generar el informe' } })
            .eq('id', reportId)
        } catch (e2: any) {
          console.error('Could not mark report as error:', e2?.message)
        }
      }
    })()
  )
}

// ¿Una fila en 'generating' está atascada (más vieja que el umbral)?
export function isGenerationStale(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  return Date.now() - new Date(createdAt).getTime() > GENERATION_STALE_MINUTES * 60_000
}

// Marca ISO a partir de la cual una fila 'generating' se considera "en curso" (no atascada).
export function activeSince(): string {
  return new Date(Date.now() - GENERATION_STALE_MINUTES * 60_000).toISOString()
}
