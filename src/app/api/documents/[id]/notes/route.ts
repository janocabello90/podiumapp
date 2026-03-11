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

    const { notes } = await request.json()

    const { data, error } = await supabase
      .from('documents')
      .update({ extracted_data: { notes } })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Error al guardar notas' }, { status: 500 })
    }

    return NextResponse.json({ document: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
