import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalize } from '@/lib/patients/rosterImport'

// Endpoint PÚBLICO — el externo no está autenticado. Autorización = posesión del token + enlace activo.
// Escritura vía service_role tras validar el token contra teams.invite_token. Mismo molde que anamnesis.
const MAX_PLAYERS = 100
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface DraftIn {
  full_name?: string
  email?: string | null
  phone?: string | null
  date_of_birth?: string | null
  gender?: string | null
  notes?: string | null
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { token } = params
    if (!token || typeof token !== 'string' || token.length < 20) {
      return NextResponse.json({ error: 'Enlace no válido' }, { status: 400 })
    }
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500 })
    }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Equipo por token (revalida activo: pudo bloquearse durante el rellenado).
    const { data: team } = await admin
      .from('teams')
      .select('id, clinic_id, invite_active')
      .eq('invite_token', token)
      .single()
    if (!team) return NextResponse.json({ error: 'Este enlace no es válido' }, { status: 404 })
    if (!team.invite_active) return NextResponse.json({ error: 'Este enlace ha sido desactivado' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const players: DraftIn[] = Array.isArray(body.players) ? body.players : []
    if (players.length === 0) return NextResponse.json({ error: 'No hay jugadores que añadir' }, { status: 400 })
    if (players.length > MAX_PLAYERS) {
      return NextResponse.json({ error: `Máximo ${MAX_PLAYERS} jugadores por envío` }, { status: 400 })
    }

    // Emails ya existentes en el equipo (para deduplicar).
    const { data: existing } = await admin
      .from('patients')
      .select('email')
      .eq('team_id', team.id)
      .eq('clinic_id', team.clinic_id)
      .eq('status', 'active')
    const existingEmails = new Set((existing || []).map((p: any) => (p.email ? normalize(p.email) : '')).filter(Boolean))

    const seen = new Set<string>()
    const toInsert: any[] = []
    let omitidos = 0
    const errores: { fila: number; motivo: string }[] = []

    players.forEach((p, i) => {
      const fila = i + 1
      const name = (p.full_name || '').toString().trim()
      if (!name) { errores.push({ fila, motivo: 'Falta el nombre' }); return }

      let email: string | null = null
      const emailRaw = (p.email || '').toString().trim()
      if (emailRaw) {
        if (!EMAIL_RE.test(emailRaw)) { errores.push({ fila, motivo: 'Email no válido' }); return }
        email = emailRaw
        const ne = normalize(emailRaw)
        if (existingEmails.has(ne) || seen.has(ne)) { omitidos++; return }
        seen.add(ne)
      }

      const dob = (p.date_of_birth || '').toString().trim()
      const gender = p.gender === 'male' || p.gender === 'female' ? p.gender : null

      toInsert.push({
        clinic_id: team.clinic_id,
        team_id: team.id,
        status: 'active',
        full_name: name,
        email,
        phone: (p.phone || '').toString().trim() || null,
        date_of_birth: ISO_DATE_RE.test(dob) ? dob : null,
        gender,
        notes: (p.notes || '').toString().trim() || null,
      })
    })

    let added = 0
    if (toInsert.length > 0) {
      const { data, error } = await admin.from('patients').insert(toInsert).select('id')
      if (error) {
        console.error('Public roster insert error:', error.message)
        return NextResponse.json({ error: 'Error al guardar los jugadores' }, { status: 500 })
      }
      added = data?.length ?? toInsert.length
    }

    return NextResponse.json({ added, omitidos, errores })
  } catch (e: any) {
    console.error('Team invite API error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
}
