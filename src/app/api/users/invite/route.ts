import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function generatePassword(length = 8): string {
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

    // Verify current user is authenticated and is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('users')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!currentProfile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    if (currentProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden crear usuarios' }, { status: 403 })
    }

    const { fullName, email, role } = await request.json()

    if (!fullName?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nombre y email son obligatorios' }, { status: 400 })
    }

    // Create Supabase admin client with service role key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada. Añádela en las variables de entorno de Vercel.' },
        { status: 500 }
      )
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Generate temporary password
    const tempPassword = generatePassword()

    // Create auth user
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: true, // Auto-confirm email so they can login immediately
    })

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
      }
      console.error('Auth create error:', authError)
      return NextResponse.json({ error: 'Error al crear usuario: ' + authError.message }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Error inesperado al crear usuario' }, { status: 500 })
    }

    // Create profile record in users table
    const { data: newUser, error: profileError } = await adminSupabase
      .from('users')
      .insert({
        id: authData.user.id,
        clinic_id: currentProfile.clinic_id,
        full_name: fullName.trim(),
        email: email.trim(),
        role: role || 'physio',
        is_active: true,
      })
      .select()
      .single()

    if (profileError) {
      // If profile creation fails, try to delete the auth user
      await adminSupabase.auth.admin.deleteUser(authData.user.id)
      console.error('Profile create error:', profileError)
      return NextResponse.json({ error: 'Error al crear perfil: ' + profileError.message }, { status: 500 })
    }

    return NextResponse.json({
      user: newUser,
      tempPassword,
    })
  } catch (error: any) {
    console.error('Invite user error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
