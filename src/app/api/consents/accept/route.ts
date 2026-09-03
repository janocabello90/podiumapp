import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// El fisio registra que el paciente ACEPTA consentimientos en consulta (presencial),
// cuando no rellenó la anamnesis digital o no los aceptó allí. Guarda una copia del
// texto vigente (trazabilidad), con anamnesis_id null y metadata.source = 'in_person'.
const OBLIGATORIOS = ['data_processing', 'info_treatment', 'ai_analysis']
const VOLUNTARIOS = ['image_rights', 'report_sharing_club']
const ALLOWED = new Set([...OBLIGATORIOS, ...VOLUNTARIOS])

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { patientId, types } = await request.json()
    if (!patientId || !Array.isArray(types)) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    const accepted = Array.from(new Set(types.filter((t: string) => ALLOWED.has(t)))) as string[]
    if (!accepted.length) return NextResponse.json({ error: 'Selecciona al menos un consentimiento' }, { status: 400 })

    // El paciente debe ser de la clínica del usuario.
    const { data: patient } = await supabase
      .from('patients').select('id, clinic_id')
      .eq('id', patientId).eq('clinic_id', profile.clinic_id).single()
    if (!patient) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Textos vigentes por tipo (copia para trazabilidad).
    const { data: versions } = await admin
      .from('consent_versions').select('type, version_label, body')
      .eq('clinic_id', profile.clinic_id).eq('is_active', true)
    const vmap = new Map((versions || []).map((v: any) => [v.type, v]))

    const now = new Date().toISOString()
    // Idempotente: quitar registros presenciales previos de esos tipos (anamnesis_id null),
    // preservando los de la anamnesis digital.
    await admin.from('consents').delete()
      .eq('patient_id', patientId).in('type', accepted).is('anamnesis_id', null)

    const rows = accepted.map((type: string) => ({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      anamnesis_id: null,
      type,
      granted: true,
      version_label: vmap.get(type)?.version_label ?? null,
      version_body: vmap.get(type)?.body ?? null,
      granted_at: now,
      metadata: { source: 'in_person', accepted_by: user.id },
    }))
    const { error } = await admin.from('consents').insert(rows)
    if (error) {
      console.error('Consent accept error:', error)
      return NextResponse.json({ error: 'No se pudo registrar el consentimiento' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: rows.length })
  } catch (error: any) {
    console.error('Consent accept error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
