import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ReportEditor from '@/components/report/ReportEditor'
import ReportGenerateButton from '@/components/report/ReportGenerateButton'

export default async function ReportPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createServerSupabaseClient()

  const { data: patient, error } = await supabase
    .from('patients')
    .select(`
      *,
      reports(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !patient) {
    notFound()
  }

  const latestReport = patient.reports?.[0]

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/patients/${patient.id}`}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Informe final</h1>
          <p className="text-sm text-gray-500">{patient.full_name}</p>
        </div>
      </div>

      {latestReport ? (
        <ReportEditor
          reportId={latestReport.id}
          patientName={patient.full_name}
          patientDob={patient.date_of_birth}
          patientGender={patient.gender}
          initialData={latestReport.report_data}
          initialStatus={latestReport.status}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Generar informe con IA</h3>
            <p className="text-sm text-gray-500">
              Claude analizar&aacute; toda la informaci&oacute;n del paciente (anamnesis, exploraci&oacute;n f&iacute;sica y datos VALD) para generar un informe completo siguiendo la plantilla PODIUM.
            </p>
            <p className="text-xs text-gray-400">
              Una vez generado, podr&aacute;s editar cada secci&oacute;n antes de aprobar y exportar a PDF.
            </p>
            <ReportGenerateButton patientId={patient.id} />
          </div>
        </div>
      )}
    </div>
  )
}
