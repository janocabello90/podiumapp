import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendAnamnesisEmail } from '@/lib/anamnesis/sendAnamnesisEmail'

// Envío MASIVO de anamnesis por correo: un envío INDEPENDIENTE por paciente (no un correo con
// todos). Para cada paciente reutiliza su anamnesis vigente o crea una nueva; salta las
// completadas y las que no tienen email. Devuelve el resumen por estado.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'El envío por correo no está configurado (falta RESEND_API_KEY en el entorno).' }, { status: 500 })
    }

    const { patientIds } = await request.json()
    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      return NextResponse.json({ error: 'patientIds requerido' }, { status: 400 })
    }
    const ids: string[] = patientIds.slice(0, 200)

    const [{ data: clinic }, { data: patients }, { data: anam }] = await Promise.all([
      supabase.from('clinics').select('name').eq('id', profile.clinic_id).single(),
      supabase.from('patients').select('id, full_name, email').in('id', ids).eq('clinic_id', profile.clinic_id),
      supabase.from('anamnesis_forms').select('patient_id, token, status, expires_at, created_at').in('patient_id', ids).eq('clinic_id', profile.clinic_id).order('created_at', { ascending: false }),
    ])
    const clinicName = clinic?.name || 'tu clínica'
    const patientMap = new Map((patients || []).map((p: any) => [p.id, p]))
    const latestAnam = new Map<string, any>()
    for (const a of anam || []) if (!latestAnam.has(a.patient_id)) latestAnam.set(a.patient_id, a)

    const origin = request.nextUrl.origin
    const now = Date.now()
    const summary = { sent: 0, no_email: 0, completed: 0, error: 0 }
    const results: Record<string, string> = {}

    for (const id of ids) {
      const patient = patientMap.get(id)
      if (!patient) { results[id] = 'error'; summary.error++; continue }
      if (!(patient.email || '').trim()) { results[id] = 'no_email'; summary.no_email++; continue }

      const latest = latestAnam.get(id)
      if (latest?.status === 'completed') { results[id] = 'completed'; summary.completed++; continue }

      // Reutilizar token vigente, o crear una anamnesis nueva.
      let token: string | null = null
      const valid = latest && latest.status !== 'expired' && (!latest.expires_at || new Date(latest.expires_at).getTime() > now)
      if (valid) {
        token = latest.token
      } else {
        const { data: created, error: insErr } = await supabase
          .from('anamnesis_forms')
          .insert({ patient_id: id, clinic_id: profile.clinic_id })
          .select('token')
          .single()
        if (insErr || !created) { results[id] = 'error'; summary.error++; continue }
        token = created.token
      }

      const sent = await sendAnamnesisEmail({
        to: patient.email.trim(),
        patientName: patient.full_name || '',
        clinicName,
        link: `${origin}/anamnesis/${token}`,
      })
      if (sent.ok) { results[id] = 'sent'; summary.sent++ }
      else { results[id] = 'error'; summary.error++ }
    }

    return NextResponse.json({ ok: true, summary, results })
  } catch (error: any) {
    console.error('bulk-send error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
