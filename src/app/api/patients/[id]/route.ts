import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar pacientes' }, { status: 403 })
    }

    const patientId = params.id

    // Verify patient belongs to this clinic
    const { data: patient } = await supabase
      .from('patients')
      .select('id, clinic_id, full_name')
      .eq('id', patientId)
      .single()

    if (!patient || patient.clinic_id !== profile.clinic_id) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
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

    // Delete in order (foreign keys): reports → documents → assessments → anamnesis_forms → patient
    await adminSupabase.from('reports').delete().eq('patient_id', patientId)

    // Delete document files from storage
    const { data: docs } = await adminSupabase
      .from('documents')
      .select('storage_path')
      .eq('patient_id', patientId)

    if (docs && docs.length > 0) {
      const paths = docs.map(d => d.storage_path).filter(Boolean)
      if (paths.length > 0) {
        await adminSupabase.storage.from('documents').remove(paths)
      }
    }

    await adminSupabase.from('documents').delete().eq('patient_id', patientId)
    await adminSupabase.from('assessments').delete().eq('patient_id', patientId)
    await adminSupabase.from('anamnesis_forms').delete().eq('patient_id', patientId)
    await adminSupabase.from('patients').delete().eq('id', patientId)

    return NextResponse.json({
      message: `Paciente "${patient.full_name}" y todos sus datos han sido eliminados`,
      deleted: true,
    })
  } catch (error: any) {
    console.error('Delete patient error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
