import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Users, FileText, ClipboardList, Activity, TrendingUp, UserCheck } from 'lucide-react'

export default async function ActivityPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const clinicId = profile.clinic_id

  // Fetch all data for metrics
  const [patientsRes, anamnesisRes, assessmentsRes, reportsRes, usersRes, documentsRes] = await Promise.all([
    supabase.from('patients').select('id, created_at, status, created_by').eq('clinic_id', clinicId),
    supabase.from('anamnesis_forms').select('id, status, created_at, completed_at').eq('clinic_id', clinicId),
    supabase.from('assessments').select('id, status, physio_id, created_at, updated_at').eq('clinic_id', clinicId),
    supabase.from('reports').select('id, status, generated_by, created_at').eq('clinic_id', clinicId),
    supabase.from('users').select('id, full_name, avatar_url, email, role, is_active').eq('clinic_id', clinicId).eq('is_active', true),
    supabase.from('documents').select('id, uploaded_by, created_at').eq('clinic_id', clinicId),
  ])

  const patients = patientsRes.data || []
  const anamnesis = anamnesisRes.data || []
  const assessments = assessmentsRes.data || []
  const reports = reportsRes.data || []
  const clinicUsers = usersRes.data || []
  const documents = documentsRes.data || []

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  // General metrics
  const activePatients = patients.filter(p => p.status === 'active').length
  const patientsThisMonth = patients.filter(p => new Date(p.created_at) >= startOfMonth).length
  const patientsLastMonth = patients.filter(p => new Date(p.created_at) >= startOfLastMonth && new Date(p.created_at) < startOfMonth).length

  const completedAnamnesis = anamnesis.filter(a => a.status === 'completed').length
  const pendingAnamnesis = anamnesis.filter(a => a.status === 'pending' || a.status === 'in_progress').length

  const completedAssessments = assessments.filter(a => a.status === 'completed').length

  const totalReports = reports.length
  const approvedReports = reports.filter(r => r.status === 'approved').length
  const draftReports = reports.filter(r => r.status === 'draft').length
  const reportsThisMonth = reports.filter(r => new Date(r.created_at) >= startOfMonth).length

  // Activity by physio
  const physioStats = clinicUsers
    .filter(u => u.role === 'physio' || u.role === 'admin')
    .map(physio => {
      const physioAssessments = assessments.filter(a => a.physio_id === physio.id).length
      const physioReports = reports.filter(r => r.generated_by === physio.id).length
      const physioDocuments = documents.filter(d => d.uploaded_by === physio.id).length
      const physioPatients = patients.filter(p => p.created_by === physio.id).length

      return {
        ...physio,
        assessments: physioAssessments,
        reports: physioReports,
        documents: physioDocuments,
        patients: physioPatients,
        total: physioAssessments + physioReports + physioDocuments + physioPatients,
      }
    })
    .sort((a, b) => b.total - a.total)

  // Completion funnel
  const funnelSteps = [
    { label: 'Pacientes registrados', value: patients.length, color: 'bg-blue-500' },
    { label: 'Anamnesis completadas', value: completedAnamnesis, color: 'bg-indigo-500' },
    { label: 'Valoraciones completadas', value: completedAssessments, color: 'bg-purple-500' },
    { label: 'Informes generados', value: totalReports, color: 'bg-pink-500' },
    { label: 'Informes aprobados', value: approvedReports, color: 'bg-green-500' },
  ]
  const maxFunnel = Math.max(...funnelSteps.map(s => s.value), 1)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Actividad</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen de la clínica</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-2">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{activePatients}</p>
          <p className="text-xs text-gray-500">Pacientes activos</p>
          {patientsThisMonth > 0 && (
            <p className="text-[10px] text-green-600 mt-1 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              +{patientsThisMonth} este mes
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center mb-2">
            <ClipboardList className="w-4 h-4 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingAnamnesis}</p>
          <p className="text-xs text-gray-500">Anamnesis pendientes</p>
          <p className="text-[10px] text-gray-400 mt-1">{completedAnamnesis} completadas</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center mb-2">
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedAssessments}</p>
          <p className="text-xs text-gray-500">Valoraciones</p>
          <p className="text-[10px] text-gray-400 mt-1">{assessments.length - completedAssessments} en curso</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-2">
            <FileText className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{approvedReports}</p>
          <p className="text-xs text-gray-500">Informes aprobados</p>
          {draftReports > 0 && (
            <p className="text-[10px] text-yellow-600 mt-1">{draftReports} borradores pendientes</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Funnel */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Embudo de pacientes</h2>
          <div className="space-y-3">
            {funnelSteps.map((step, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">{step.label}</span>
                  <span className="font-semibold text-gray-900">{step.value}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${step.color} transition-all`}
                    style={{ width: `${Math.max((step.value / maxFunnel) * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity by physio */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Actividad por fisio</h2>
          {physioStats.length === 0 ? (
            <p className="text-sm text-gray-400">No hay fisios registrados</p>
          ) : (
            <div className="space-y-3">
              {physioStats.map((physio) => (
                <div key={physio.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    {physio.avatar_url ? (
                      <img src={physio.avatar_url} alt={physio.full_name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-blue-700">
                        {physio.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{physio.full_name}</p>
                    <p className="text-[10px] text-gray-400">
                      {physio.patients} pac · {physio.assessments} val · {physio.reports} inf · {physio.documents} doc
                    </p>
                  </div>
                  <span className="text-xs font-bold text-gray-700">{physio.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
