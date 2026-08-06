import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// El fisio revoca (o reactiva) un consentimiento en consulta. No borra el registro: marca
// revoked_at/revoked_by para que quede constancia de que se aceptó y luego se revocó.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { consentId, revoke } = await request.json()
    if (!consentId) return NextResponse.json({ error: 'consentId requerido' }, { status: 400 })

    // Verificar que el consentimiento es de la clínica del usuario.
    const { data: consent } = await supabase
      .from('consents')
      .select('id, clinic_id')
      .eq('id', consentId)
      .eq('clinic_id', profile.clinic_id)
      .single()
    if (!consent) return NextResponse.json({ error: 'Consentimiento no encontrado' }, { status: 404 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const doRevoke = revoke !== false
    const { error } = await admin
      .from('consents')
      .update({
        revoked_at: doRevoke ? new Date().toISOString() : null,
        revoked_by: doRevoke ? user.id : null,
      })
      .eq('id', consentId)
    if (error) {
      console.error('Consent revoke error:', error)
      return NextResponse.json({ error: 'No se pudo actualizar el consentimiento' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, revoked: doRevoke })
  } catch (error: any) {
    console.error('Consent revoke error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
