import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public endpoint — patient is not authenticated. Authorization = possession of the token.
// The token is a UUID generated per patient and is only known to the patient (sent via whatsapp/email).
// We use service_role so the update bypasses RLS but we verify the token belongs to an existing,
// non-expired anamnesis form before writing.

export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    if (!token || typeof token !== 'string' || token.length < 20) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the anamnesis exists and is not expired or already completed
    const { data: existing, error: fetchError } = await adminSupabase
      .from('anamnesis_forms')
      .select('id, status, expires_at')
      .eq('token', token)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Formulario expirado' }, { status: 410 })
    }

    const body = await request.json()
    const { action, form_data, consent_data_processing, consent_ai_analysis } = body

    const updatePayload: Record<string, any> = {}

    if (action === 'consent') {
      // Save consent checkboxes at start
      updatePayload.consent_data_processing = !!consent_data_processing
      updatePayload.consent_ai_analysis = !!consent_ai_analysis
      updatePayload.consent_timestamp = new Date().toISOString()
    } else if (action === 'autosave') {
      if (form_data && typeof form_data === 'object') {
        updatePayload.form_data = form_data
      }
      if (existing.status === 'pending') {
        updatePayload.status = 'in_progress'
        updatePayload.started_at = new Date().toISOString()
      }
    } else if (action === 'submit') {
      if (form_data && typeof form_data === 'object') {
        updatePayload.form_data = form_data
      }
      updatePayload.status = 'completed'
      updatePayload.completed_at = new Date().toISOString()
      if (consent_data_processing !== undefined) {
        updatePayload.consent_data_processing = !!consent_data_processing
      }
      if (consent_ai_analysis !== undefined) {
        updatePayload.consent_ai_analysis = !!consent_ai_analysis
      }
      if (!updatePayload.consent_timestamp) {
        updatePayload.consent_timestamp = new Date().toISOString()
      }
    } else {
      return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
    }

    const { error: updateError } = await adminSupabase
      .from('anamnesis_forms')
      .update(updatePayload)
      .eq('token', token)

    if (updateError) {
      console.error('Anamnesis update error:', updateError)
      return NextResponse.json({ error: 'Error al guardar: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Anamnesis API error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
