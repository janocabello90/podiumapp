import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendAnamnesisEmail } from '@/lib/anamnesis/sendAnamnesisEmail'

// Envía por correo (Resend) el enlace de la anamnesis al paciente.
// Requiere RESEND_API_KEY en el entorno; el remitente sale de RESEND_FROM (con dominio
// verificado en Resend). Sin esas variables, devuelve un 500 claro y no rompe la app.
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

    const { token } = await request.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'token requerido' }, { status: 400 })
    }

    // Anamnesis por token, dentro de la clínica del usuario (RLS + filtro explícito).
    const { data: anamnesis } = await supabase
      .from('anamnesis_forms')
      .select('token, clinic_id, patients(full_name, email)')
      .eq('token', token)
      .eq('clinic_id', profile.clinic_id)
      .single()
    if (!anamnesis) return NextResponse.json({ error: 'Anamnesis no encontrada' }, { status: 404 })

    const patient = (anamnesis.patients as any) || {}
    const to = (patient.email || '').trim()
    if (!to) {
      return NextResponse.json({ error: 'El paciente no tiene email registrado. Añádelo en su ficha.' }, { status: 400 })
    }

    const { data: clinic } = await supabase.from('clinics').select('name').eq('id', profile.clinic_id).single()
    const clinicName = clinic?.name || 'tu clínica'
    const base = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '')
    const link = `${base}/anamnesis/${anamnesis.token}`

    const sent = await sendAnamnesisEmail({ to, patientName: patient.full_name || '', clinicName, link })
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error || 'No se pudo enviar el correo.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, to })
  } catch (error: any) {
    console.error('send-email error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
