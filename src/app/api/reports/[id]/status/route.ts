import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isGenerationStale } from '@/lib/reports/background'

// Estado de un informe (para el polling de la UI). Auth + clínica-scoped.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const { data: report } = await supabase
    .from('reports')
    .select('id, status, created_at, report_data')
    .eq('id', params.id)
    .eq('clinic_id', profile.clinic_id)
    .single()
  if (!report) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  let status = report.status
  let error: string | null = (report.report_data as any)?._error || null
  // "Atascado": si lleva demasiado en 'generating', se trata como error (la función habrá muerto).
  if (status === 'generating' && isGenerationStale(report.created_at)) {
    status = 'error'
    error = 'La generación tardó demasiado. Reinténtalo.'
  }

  return NextResponse.json({ status, error })
}
