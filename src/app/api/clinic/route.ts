import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Get user profile to find clinic_id
    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { name, phone, email, address } = await request.json()

    const { error } = await supabase
      .from('clinics')
      .update({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.clinic_id)

    if (error) {
      console.error('Clinic update error:', error)
      return NextResponse.json({ error: 'Error al actualizar: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Clinic API error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
