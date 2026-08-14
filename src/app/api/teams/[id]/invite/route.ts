import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Gestión del enlace público de alta de jugadores del equipo (autenticado, clínica-scoped).
// action: generate | regenerate | block | activate. Fisios y admins (cualquier usuario de la clínica).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    // El equipo debe ser de la clínica del usuario.
    const { data: team } = await supabase
      .from('teams')
      .select('id, clinic_id')
      .eq('id', params.id)
      .eq('clinic_id', profile.clinic_id)
      .single()
    if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

    const { action } = await request.json()
    let patch: { invite_token?: string; invite_active?: boolean }
    if (action === 'generate' || action === 'regenerate') patch = { invite_token: randomUUID(), invite_active: true }
    else if (action === 'block') patch = { invite_active: false }
    else if (action === 'activate') patch = { invite_active: true }
    else return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })

    const { data: updated, error } = await supabase
      .from('teams')
      .update(patch)
      .eq('id', params.id)
      .eq('clinic_id', profile.clinic_id)
      .select('invite_token, invite_active')
      .single()
    if (error) return NextResponse.json({ error: 'No se pudo actualizar el enlace' }, { status: 500 })

    return NextResponse.json({ invite_token: updated.invite_token, invite_active: updated.invite_active })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 })
  }
}
