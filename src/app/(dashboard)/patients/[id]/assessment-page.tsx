import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AssessmentForm from '@/components/assessment/AssessmentForm'

export default async function AssessmentPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createServerSupabaseClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, clinic_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Fetch patient
  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, full_name, clinic_id')
    .eq('id', params.id)
    .single()

  if (error || !patient) notFound()

  // Fetch or create assessment
  let { data: assessment } = await supabase
    .from('assessments')
    .select('*')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!assessment) {
    const { data: newAssessment, error: createError } = await supabase
      .from('assessments')
      .insert({
        patient_id: params.id,
        clinic_id: patient.clinic_id,
        physio_id: profile.id,
        session_number: 1,
        status: 'in_progress',
        assessment_data: {},
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating assessment:', createError)
      notFound()
    }
    assessment = newAssessment
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/patients/${params.id}`}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Valoración del fisio</h1>
          <p className="text-gray-500 mt-0.5">{patient.full_name} · Sesión {assessment.session_number}</p>
        </div>
      </div>

      <AssessmentForm
        assessmentId={assessment.id}
        patientId={patient.id}
        initialData={assessment.assessment_data || {}}
        initialStatus={assessment.status}
      />
    </div>
  )
}
