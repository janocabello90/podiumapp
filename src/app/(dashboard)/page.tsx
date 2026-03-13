import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react'

export default async function ReportsPage() {
  const supabase = createServerSupabaseClient()

  // Get current user's clinic_id
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Fetch all reports with patient and generator info
  const { data: reports } = await supabase
    .from('reports')
    .select(`
      *,
      patients(id, full_name),
      generator:users!reports_generated_by_fkey(id, full_name, avatar_url, email)
    `)
    .eq('clinic_id', profile.clinic_id)
    .order('created_at', { ascending: false })

  // Fetch all users in the clinic for traceability
  const { data: clinicUsers } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, email')
    .eq('clinic_id', profile.clinic_id)
    .eq('is_active', true)

  const usersMap = new Map((clinicUsers || []).map(u => [u.id, u]))

  // Also fetch assessments to know which physio did each assessment
  const { data: assessments } = await supabase
    .from('assessments')
    .select('id, patient_id, physio_id, status, updated_at')
    .eq('clinic_id', profile.clinic_id)

  // And documents to know who uploaded them
  const { data: documents } = await supabase
    .from('documents')
    .select('id, patient_id, uploaded_by, created_at')
    .eq('clinic_id', profile.clinic_id)

  // Build traceability map: patientId -> Set of user IDs who interacted
  const traceabilityMap = new Map<string, Set<string>>()

  function addInteraction(patientId: string, userId: string | null) {
    if (!userId) return
    if (!traceabilityMap.has(patientId)) traceabilityMap.set(patientId, new Set())
    traceabilityMap.get(patientId)!.add(userId)
  }

  // From reports
  for (const r of (reports || [])) {
    addInteraction(r.patient_id, r.generated_by)
  }

  // From assessments
  for (const a of (assessments || [])) {
    addInteraction(a.patient_id, a.physio_id)
  }

  // From documents
  for (const d of (documents || [])) {
    addInteraction(d.patient_id, d.uploaded_by)
  }

  // Stats
  const allReports = reports || []
  const totalReports = allReports.length
  const approvedReports = allReports.filter(r => r.status === 'approved').length
  const draftReports = allReports.filter(r => r.status === 'draft').length

  // This month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthReports = allReports.filter(r => new Date(r.created_at) >= startOfMonth).length

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Informes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Todos los informes generados por la clínica</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalReports}</p>
          <p className="text-xs text-gray-500">Total informes</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{approvedReports}</p>
          <p className="text-xs text-gray-500">Aprobados</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{draftReports}</p>
          <p className="text-xs text-gray-500">Borradores</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{thisMonthReports}</p>
          <p className="text-xs text-gray-500">Este mes</p>
        </div>
      </div>

      {/* Reports list */}
      {allReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay informes generados todavía</p>
          <p className="text-sm text-gray-400 mt-1">Los informes aparecerán aquí cuando se generen desde la ficha de un paciente</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {allReports.map((report) => {
              const patientInteractors = traceabilityMap.get(report.patient_id) || new Set()
              const interactorUsers = Array.from(patientInteractors)
                .map(uid => usersMap.get(uid))
                .filter(Boolean)

              return (
                <Link
                  key={report.id}
                  href={`/patients/${report.patient_id}/report`}
                  className="block px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {(report.patients as any)?.full_name || 'Paciente'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(report.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      {/* Physio traceability */}
                      {interactorUsers.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <div className="flex items-center -space-x-1.5">
                            {interactorUsers.slice(0, 4).map((u: any) => (
                              <div
                                key={u.id}
                                className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center"
                                title={u.full_name}
                              >
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt={u.full_name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  <span className="text-[8px] font-medium text-blue-700">
                                    {u.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <span className="text-[10px] text-gray-400 truncate">
                            {interactorUsers.map((u: any) => u.full_name.split(' ')[0]).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {report.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Aprobado
                        </span>
                      ) : report.status === 'draft' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-700">
                          <Clock className="w-3 h-3" />
                          Borrador
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">
                          <AlertCircle className="w-3 h-3" />
                          {report.status}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
