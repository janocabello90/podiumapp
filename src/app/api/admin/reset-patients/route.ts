import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Verify current user is admin
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
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
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

    const clinicId = profile.clinic_id

    // Get all patients for this clinic
    const { data: patients } = await adminSupabase
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)

    if (!patients || patients.length === 0) {
      return NextResponse.json({ message: 'No hay pacientes que borrar', deleted: 0 })
    }

    const patientIds = patients.map(p => p.id)

    // Delete in order (due to foreign keys): reports → documents → assessments → anamnesis_forms → patients
    const { error: reportsErr } = await adminSupabase
      .from('reports')
      .delete()
      .in('patient_id', patientIds)
    if (reportsErr) console.error('Error deleting reports:', reportsErr)

    // Delete document files from storage first
    const { data: docs } = await adminSupabase
      .from('documents')
      .select('storage_path')
      .in('patient_id', patientIds)

    if (docs && docs.length > 0) {
      const paths = docs.map(d => d.storage_path).filter(Boolean)
      if (paths.length > 0) {
        await adminSupabase.storage.from('documents').remove(paths)
      }
    }

    const { error: docsErr } = await adminSupabase
      .from('documents')
      .delete()
      .in('patient_id', patientIds)
    if (docsErr) console.error('Error deleting documents:', docsErr)

    const { error: assessErr } = await adminSupabase
      .from('assessments')
      .delete()
      .in('patient_id', patientIds)
    if (assessErr) console.error('Error deleting assessments:', assessErr)

    const { error: anamErr } = await adminSupabase
      .from('anamnesis_forms')
      .delete()
      .in('patient_id', patientIds)
    if (anamErr) console.error('Error deleting anamnesis:', anamErr)

    const { error: patErr } = await adminSupabase
      .from('patients')
      .delete()
      .eq('clinic_id', clinicId)
    if (patErr) console.error('Error deleting patients:', patErr)

    return NextResponse.json({
      message: `${patientIds.length} paciente(s) eliminados correctamente`,
      deleted: patientIds.length,
    })
  } catch (error: any) {
    console.error('Reset patients error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
