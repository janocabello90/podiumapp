import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó imagen' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no válido. Usa PNG, JPG, WEBP o SVG.' }, { status: 400 })
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande. Máximo 2MB.' }, { status: 400 })
    }

    // Use service role for storage operations (avoids RLS issues)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada.' },
        { status: 500 }
      )
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const ext = file.name.split('.').pop() || 'png'
    const fileName = `${profile.clinic_id}/logo_${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to storage
    const { error: uploadError } = await adminSupabase.storage
      .from('logos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Error al subir imagen: ' + uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = adminSupabase.storage
      .from('logos')
      .getPublicUrl(fileName)

    const logoUrl = urlData.publicUrl

    // Update clinic record
    const { error: updateError } = await adminSupabase
      .from('clinics')
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq('id', profile.clinic_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Error al actualizar clínica: ' + updateError.message }, { status: 500 })
    }

    revalidatePath('/settings')
    return NextResponse.json({ logo_url: logoUrl })
  } catch (error: any) {
    console.error('Logo upload error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
