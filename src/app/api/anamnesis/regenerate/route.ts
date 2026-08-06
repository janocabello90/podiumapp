import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Regenera la anamnesis de un paciente: BORRA la actual (la rellenó mal) y crea una nueva
// en blanco con enlace nuevo para que la rellene otra vez. La traza de consentimientos se
// conserva (consents.anamnesis_id es ON DELETE SET NULL). Usa service_role para el borrado
// (no hay policy DELETE clínica en anamnesis_forms).
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { anamnesisId } = await request.json()
    if (!anamnesisId) return NextResponse.json({ error: 'anamnesisId requerido' }, { status: 400 })

    // Verificar que la anamnesis es de la clínica del usuario.
    const { data: anam } = await supabase
      .from('anamnesis_forms')
      .select('id, patient_id, clinic_id')
      .eq('id', anamnesisId)
      .eq('clinic_id', profile.clinic_id)
      .single()
    if (!anam) return NextResponse.json({ error: 'Anamnesis no encontrada' }, { status: 404 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Borrar la anamnesis actual (los consents quedan con anamnesis_id = NULL).
    const { error: delErr } = await admin.from('anamnesis_forms').delete().eq('id', anamnesisId)
    if (delErr) {
      console.error('Regenerate delete error:', delErr)
      return NextResponse.json({ error: 'No se pudo borrar la anamnesis anterior' }, { status: 500 })
    }

    // Crear una nueva anamnesis en blanco para el mismo paciente.
    const { data: created, error: insErr } = await admin
      .from('anamnesis_forms')
      .insert({ patient_id: anam.patient_id, clinic_id: anam.clinic_id })
      .select('token')
      .single()
    if (insErr || !created) {
      console.error('Regenerate insert error:', insErr)
      return NextResponse.json({ error: 'No se pudo crear la nueva anamnesis' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, token: created.token })
  } catch (error: any) {
    console.error('Regenerate error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
