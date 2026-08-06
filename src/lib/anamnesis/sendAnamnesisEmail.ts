// Envío de UN correo de anamnesis vía Resend (REST). Reutilizado por el envío individual
// y el envío masivo (uno por paciente). Devuelve { ok, error } sin lanzar.

export function buildAnamnesisEmailHtml(opts: { firstName: string; clinicName: string; link: string }): string {
  const { firstName, clinicName, link } = opts
  return `
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
}

export async function sendAnamnesisEmail(opts: {
  to: string
  patientName: string
  clinicName: string
  link: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'El envío por correo no está configurado (falta RESEND_API_KEY).' }
  const from = process.env.RESEND_FROM || 'Clínica Podium <onboarding@resend.dev>'
  const firstName = (opts.patientName || '').split(' ')[0]
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: `Cuestionario previo a tu cita en ${opts.clinicName}`,
        html: buildAnamnesisEmailHtml({ firstName, clinicName: opts.clinicName, link: opts.link }),
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: err?.message || 'No se pudo enviar el correo (revisa Resend).' }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error al enviar el correo' }
  }
}
