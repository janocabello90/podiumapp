import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: currentProfile } = await supabase
      .from('users')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!currentProfile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    if (currentProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar usuarios' }, { status: 403 })
    }

    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    if (userId === user.id) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }

    // El objetivo debe ser de la misma clínica
    const { data: target } = await supabase
      .from('users')
      .select('id, clinic_id')
      .eq('id', userId)
      .single()
    if (!target || target.clinic_id !== currentProfile.clinic_id) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // No se puede borrar si tiene datos clínicos asociados (FK NO ACTION + trazabilidad)
    const checks = await Promise.all([
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('physio_id', userId),
      supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('physio_id', userId),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('generated_by', userId),
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('created_by', userId),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('uploaded_by', userId),
    ])
    const authored = checks.reduce((n, c) => n + (c.count || 0), 0)
    if (authored > 0) {
      return NextResponse.json(
        { error: 'Este usuario tiene datos clínicos asociados (consultas, informes…). No se puede eliminar; desactívalo para conservar la trazabilidad.' },
        { status: 400 }
      )
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada. Añádela en las variables de entorno de Vercel.' },
        { status: 500 }
      )
    }
    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Borrar primero el registro de public.users (FK a auth.users), luego el usuario de Auth
    const { error: rowErr } = await adminSupabase.from('users').delete().eq('id', userId)
    if (rowErr) {
      return NextResponse.json({ error: 'Error al eliminar el registro del usuario' }, { status: 500 })
    }
    const { error: authErr } = await adminSupabase.auth.admin.deleteUser(userId)
    if (authErr) {
      // El registro ya se borró; avisamos pero no es fatal para la app
      console.error('Auth delete error:', authErr)
    }

    revalidatePath('/settings')
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('User delete error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
