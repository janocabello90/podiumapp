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
      .select('id, status, expires_at, patient_id, clinic_id')
      .eq('token', token)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Formulario expirado' }, { status: 410 })
    }

    const body = await request.json()
    const { action, form_data, consent_data_processing, consent_info_treatment, consent_ai_analysis, consent_image_rights, image_channels, is_minor, representative } = body

    const updatePayload: Record<string, any> = {}

    if (action === 'consent') {
      // Save consent checkboxes at start
      updatePayload.consent_data_processing = !!consent_data_processing
      updatePayload.consent_ai_analysis = !!consent_ai_analysis
      updatePayload.consent_timestamp = new Date().toISOString()
      // Persistir datos ya escritos (p. ej. representante legal del menor) para que sobrevivan a recargas.
      if (form_data && typeof form_data === 'object') {
        updatePayload.form_data = form_data
      }
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

    // Trazabilidad de consentimientos: solo al enviar (autoritativo). service_role.
    // No fatal: un fallo aquí no bloquea el envío del formulario del paciente.
    if (action === 'submit') {
      try {
        const { data: versions } = await adminSupabase
          .from('consent_versions')
          .select('type, version_label, body')
          .eq('clinic_id', existing.clinic_id)
          .eq('is_active', true)
        const vmap = new Map((versions || []).map((v: any) => [v.type, v]))
        const granted: Record<string, boolean> = {
          data_processing: !!consent_data_processing,
          info_treatment: !!consent_info_treatment,
          ai_analysis: !!consent_ai_analysis,
        }
        // Si es menor, el consentimiento lo otorga el representante legal → se estampa en la traza.
        const repMeta = is_minor && representative && (representative.name || representative.relation)
          ? { representative: { name: representative.name || null, dni: representative.dni || null, relation: representative.relation || null } }
          : null

        const rows: any[] = (['data_processing', 'info_treatment', 'ai_analysis'] as const).map((type) => ({
          clinic_id: existing.clinic_id,
          patient_id: existing.patient_id,
          anamnesis_id: existing.id,
          type,
          granted: granted[type],
          version_label: vmap.get(type)?.version_label ?? null,
          version_body: vmap.get(type)?.body ?? null,
          granted_at: new Date().toISOString(),
          metadata: repMeta,
        }))
        // Derechos de imagen (solo llega en anamnesis de equipo). Registra los canales aceptados.
        if (consent_image_rights !== undefined) {
          rows.push({
            clinic_id: existing.clinic_id,
            patient_id: existing.patient_id,
            anamnesis_id: existing.id,
            type: 'image_rights',
            granted: !!consent_image_rights,
            version_label: vmap.get('image_rights')?.version_label ?? null,
            version_body: vmap.get('image_rights')?.body ?? null,
            granted_at: new Date().toISOString(),
            metadata: (() => {
              const m: any = { ...(repMeta || {}) }
              if (consent_image_rights && Array.isArray(image_channels) && image_channels.length) m.channels = image_channels
              return Object.keys(m).length ? m : null
            })(),
          })
        }
        // Idempotente: borrar los de esta anamnesis antes de reinsertar.
        await adminSupabase.from('consents').delete().eq('anamnesis_id', existing.id)
        const { error: consentErr } = await adminSupabase.from('consents').insert(rows)
        if (consentErr) console.error('Consents insert error:', consentErr.message)
      } catch (e: any) {
        console.error('Consents recording failed (non-fatal):', e?.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Anamnesis API error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
