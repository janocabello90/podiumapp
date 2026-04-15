import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    // Verify document belongs to user's clinic
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id, clinic_id')
      .eq('id', params.id)
      .single()

    if (!existingDoc || existingDoc.clinic_id !== profile.clinic_id) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const { notes } = await request.json()

    const { data, error } = await supabase
      .from('documents')
      .update({ extracted_data: { notes } })
      .eq('id', params.id)
      .eq('clinic_id', profile.clinic_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Error al guardar notas' }, { status: 500 })
    }

    return NextResponse.json({ document: data })
  } catch (error: any) {
    console.error('Notes update error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
