import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// Crea una URL firmada para subir un documento DIRECTAMENTE a Supabase Storage desde el
// navegador, sin pasar el archivo por la API route (Vercel limita el body a ~4,5 MB, y los
// PDF de VALD/HumanTrak suelen ser mayores). Luego el cliente registra los metadatos en
// POST /api/documents (JSON).
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { patient_id, file_name, session_id } = await request.json()
    if (!patient_id || !file_name) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    // El paciente debe ser de la clínica del usuario.
    const { data: patientCheck } = await supabase.from('patients').select('id, clinic_id').eq('id', patient_id).single()
    if (!patientCheck || patientCheck.clinic_id !== profile.clinic_id) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
    }
    // La sesión, si se indica, debe ser del paciente + clínica.
    if (session_id) {
      const { data: s } = await supabase.from('sessions').select('id, patient_id, clinic_id').eq('id', session_id).single()
      if (!s || s.clinic_id !== profile.clinic_id || s.patient_id !== patient_id) {
        return NextResponse.json({ error: 'Sesión no válida para este paciente' }, { status: 404 })
      }
    }

    const admin = createAdminSupabaseClient()
    // Asegurar que el bucket acepta PDF e imágenes.
    try {
      await admin.storage.updateBucket('documents', {
        public: false,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
      })
    } catch { /* no fatal */ }

    const safeName = String(file_name).replace(/[^\w.\-]+/g, '_').slice(0, 120)
    const path = `${profile.clinic_id}/${patient_id}/${Date.now()}_${safeName}`
    const { data, error } = await admin.storage.from('documents').createSignedUploadUrl(path)
    if (error || !data) {
      console.error('createSignedUploadUrl error:', error)
      return NextResponse.json({ error: 'No se pudo preparar la subida' }, { status: 500 })
    }
    return NextResponse.json({ path: data.path, token: data.token })
  } catch (error: any) {
    console.error('upload-url error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
