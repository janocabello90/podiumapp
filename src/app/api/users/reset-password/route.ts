import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function generatePassword(length = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Verify current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('users')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!currentProfile || currentProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden resetear contraseñas' }, { status: 403 })
    }

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    // Verify target user belongs to same clinic
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, clinic_id, email, full_name')
      .eq('id', userId)
      .single()

    if (!targetUser || targetUser.clinic_id !== currentProfile.clinic_id) {
      return NextResponse.json({ error: 'Usuario no encontrado en tu clínica' }, { status: 404 })
    }

    // Create admin client
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Generate new password and update the user
    const newPassword = generatePassword()

    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Reset password error:', updateError)
      return NextResponse.json({ error: 'Error al resetear: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      newPassword,
      userName: targetUser.full_name,
      userEmail: targetUser.email,
    })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
