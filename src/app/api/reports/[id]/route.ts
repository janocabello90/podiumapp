import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Update report data (for editing sections)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Get user's clinic
    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    // Verify the report belongs to this clinic
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id, clinic_id')
      .eq('id', params.id)
      .single()

    if (!existingReport || existingReport.clinic_id !== profile.clinic_id) {
      return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 })
    }

    const body = await request.json()

    const updateData: Record<string, any> = {}
    if (body.report_data) updateData.report_data = body.report_data
    if (body.status && ['draft', 'approved', 'sent'].includes(body.status)) {
      updateData.status = body.status
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data: report, error } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', params.id)
      .eq('clinic_id', profile.clinic_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json({ report })
  } catch (error: any) {
    console.error('Report update error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
