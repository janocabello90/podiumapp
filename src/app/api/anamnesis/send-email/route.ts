import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
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
    const firstName = (patient.full_name || '').split(' ')[0]
    const link = `${request.nextUrl.origin}/anamnesis/${anamnesis.token}`
    const from = process.env.RESEND_FROM || 'Clínica Podium <onboarding@resend.dev>'

    const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8ff;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e1e2eb;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 36px 4px;">
        <h1 style="margin:8px 0 6px;font-size:20px;font-weight:700;color:#17324a;">Hola${firstName ? ` ${firstName}` : ''} 👋</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#434653;">
          Antes de tu cita en <strong>${clinicName}</strong>, necesitamos que rellenes este breve cuestionario (anamnesis). Solo te llevará unos minutos y nos permite dedicarte más tiempo en consulta.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td align="center" style="padding:6px 0 20px;">
            <a href="${link}" style="display:inline-block;background:#2d6f73;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 30px;border-radius:12px;">Rellenar cuestionario</a>
          </td>
        </tr></table>
        <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#8a8f9c;">Si el botón no funciona, copia y pega este enlace:</p>
        <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#2d6f73;word-break:break-all;">${link}</p>
      </td></tr>
      <tr><td style="padding:14px 36px 26px;border-top:1px solid #eef2f4;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#a0a6b0;">${clinicName} · Si no esperabas este correo, puedes ignorarlo.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `Cuestionario previo a tu cita en ${clinicName}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Resend error:', err)
      return NextResponse.json({ error: err?.message || 'No se pudo enviar el correo (revisa la configuración de Resend).' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, to })
  } catch (error: any) {
    console.error('send-email error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
