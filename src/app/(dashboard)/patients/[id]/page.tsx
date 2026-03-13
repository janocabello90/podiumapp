import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, FileText, Upload, Mic, Check } from 'lucide-react'
import AnamnesisActions from '@/components/patients/AnamnesisActions'
import DocumentSection from '@/components/documents/DocumentSection'

export default async function PatientDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createServerSupabaseClient()

  // Fetch patient with related data
  const { data: patient, error } = await supabase
    .from('patients')
    .select(`
      *,
      anamnesis_forms(*),
      assessments(*),
      documents(*),
      reports(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !patient) {
    notFound()
  }

  const latestAnamnesis = patient.anamnesis_forms?.[0]
  const latestAssessment = patient.assessments?.[0]
  const patientDocuments = patient.documents || []
  const hasDocuments = patientDocuments.length > 0
  const latestReport = patient.reports?.[0]
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link
          href="/patients"
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{patient.full_name}</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {[
              age ? `${age} años` : null,
              patient.phone,
              patient.email,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main content - left column */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Workflow steps */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Proceso del paciente</h2>

            <div className="space-y-3 sm:space-y-4">
              {/* Step 1: Anamnesis */}
              <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  latestAnamnesis?.status === 'completed'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">1. Anamnesis</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {latestAnamnesis?.status === 'completed'
                      ? 'Completada por el paciente'
                      : latestAnamnesis?.status === 'pending' || latestAnamnesis?.status === 'in_progress'
                      ? 'Enlace enviado, esperando respuesta'
                      : 'Envía el formulario al paciente'}
                  </p>
                  <AnamnesisActions
                    patientId={patient.id}
                    clinicId={patient.clinic_id}
                    patientName={patient.full_name}
                    currentAnamnesis={latestAnamnesis}
                  />
                </div>
              </div>

              {/* Step 2: Assessment */}
              <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  latestAssessment?.status === 'completed'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">2. Valoración del fisio</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {latestAssessment?.status === 'completed'
                      ? 'Valoración completada'
                      : latestAssessment
                      ? 'Valoración en curso'
                      : 'Exploración física + dictado por voz'}
                  </p>
                  <div className="mt-2 sm:mt-3">
                    {latestAssessment?.status === 'completed' ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                          <Check className="w-3 h-3" />
                          Completada
                        </span>
                        <Link
                          href={`/patients/${patient.id}/assessment`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Ver / editar
                        </Link>
                      </div>
                    ) : (
                      <Link
                        href={`/patients/${patient.id}/assessment`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Mic className="w-3 h-3" />
                        {latestAssessment ? 'Continuar valoración' : 'Iniciar valoración'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: VALD */}
              <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  hasDocuments
                    ? 'bg-green-100 text-green-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">3. Informes VALD</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {hasDocuments
                      ? `${patientDocuments.length} informe${patientDocuments.length > 1 ? 's' : ''} subido${patientDocuments.length > 1 ? 's' : ''}`
                      : 'Sube los PDF de valoración funcional'}
                  </p>
                  <div className="mt-2 sm:mt-3">
                    <DocumentSection
                      patientId={patient.id}
                      clinicId={patient.clinic_id}
                      initialDocuments={patientDocuments}
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Report */}
              <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  latestReport?.status === 'approved'
                    ? 'bg-green-100 text-green-600'
                    : latestReport
                    ? 'bg-yellow-100 text-yellow-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">4. Informe final</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {latestReport?.status === 'approved'
                      ? 'Informe aprobado'
                      : latestReport
                      ? 'Borrador generado — pendiente de revisión'
                      : 'Generación automática con IA'}
                  </p>
                  <div className="mt-2 sm:mt-3">
                    {latestReport?.status === 'approved' ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                          <Check className="w-3 h-3" />
                          Aprobado
                        </span>
                        <Link
                          href={`/patients/${patient.id}/report`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Ver / editar / PDF
                        </Link>
                      </div>
                    ) : latestReport ? (
                      <Link
                        href={`/patients/${patient.id}/report`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        Revisar borrador
                      </Link>
                    ) : (
                      <Link
                        href={`/patients/${patient.id}/report`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        Generar informe
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - right column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Patient info card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Datos del paciente</h3>
            <dl className="space-y-3 text-sm">
              {patient.phone && (
                <div>
                  <dt className="text-gray-400">Teléfono</dt>
                  <dd className="text-gray-700 mt-0.5">
                    <a href={`tel:${patient.phone}`} className="hover:text-blue-600">{patient.phone}</a>
                  </dd>
                </div>
              )}
              {patient.email && (
                <div>
                  <dt className="text-gray-400">Email</dt>
                  <dd className="text-gray-700 mt-0.5 truncate">
                    <a href={`mailto:${patient.email}`} className="hover:text-blue-600">{patient.email}</a>
                  </dd>
                </div>
              )}
              {patient.date_of_birth && (
                <div>
                  <dt className="text-gray-400">Fecha de nacimiento</dt>
                  <dd className="text-gray-700 mt-0.5">
                    {new Date(patient.date_of_birth).toLocaleDateString('es-ES')}
                    {age ? ` (${age} años)` : ''}
                  </dd>
                </div>
              )}
              {patient.gender && (
                <div>
                  <dt className="text-gray-400">Sexo</dt>
                  <dd className="text-gray-700 mt-0.5">
                    {({ male: 'Masculino', female: 'Femenino', other: 'Otro' } as Record<string, string>)[patient.gender || '']}
                  </dd>
                </div>
              )}
              {patient.notes && (
                <div>
                  <dt className="text-gray-400">Notas</dt>
                  <dd className="text-gray-700 mt-0.5">{patient.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Timeline / Activity */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Actividad</h3>
            <p className="text-sm text-gray-400">
              Creado el {new Date(patient.created_at).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
