import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, FileText, Upload, Mic, Check, Camera, Shield, Megaphone } from 'lucide-react'
import AnamnesisActions from '@/components/patients/AnamnesisActions'
import DocumentSection from '@/components/documents/DocumentSection'
import ImageGallerySection from '@/components/documents/ImageGallerySection'
import RefreshButton from '@/components/patients/RefreshButton'
import DeletePatientButton from '@/components/patients/DeletePatientButton'
import SportSelect from '@/components/sports/SportSelect'
import { consentLabel } from '@/lib/clinical/consents'
import StartSessionButton from '@/components/sessions/StartSessionButton'
import DeleteSessionButton from '@/components/sessions/DeleteSessionButton'

// Force dynamic rendering so refresh always gets fresh data
export const dynamic = 'force-dynamic'

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
      teams(id, name, category, group_id, groups(name), sport_id, sports(name)),
      anamnesis_forms(*),
      assessments(*),
      sessions(*),
      documents(*),
      reports(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !patient) {
    notFound()
  }

  // Rol del usuario actual (para acciones restringidas a admin, p. ej. borrar paciente)
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const { data: currentProfile } = currentUser
    ? await supabase.from('users').select('role').eq('id', currentUser.id).single()
    : { data: null as any }
  const isAdmin = currentProfile?.role === 'admin'

  // Deportes activos de la clínica (para el override de deporte del paciente).
  // RLS limita a la clínica del usuario autenticado.
  const { data: sports } = await supabase
    .from('sports')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Consentimientos registrados (trazabilidad) — último por tipo
  const { data: rawConsents } = await supabase
    .from('consents')
    .select('type, granted, granted_at, version_label')
    .eq('patient_id', params.id)
    .order('granted_at', { ascending: false })
  const consentsByType = new Map<string, any>()
  for (const c of rawConsents || []) {
    if (!consentsByType.has(c.type)) consentsByType.set(c.type, c)
  }
  const consents = Array.from(consentsByType.values())

  // Sort anamnesis by creation date to get latest
  const sortedAnamnesis = (patient.anamnesis_forms || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const latestAnamnesis = sortedAnamnesis[0]
  const allSessions = ((patient.sessions as any[]) || []).sort(
    (a: any, b: any) => (b.session_number || 0) - (a.session_number || 0)
  )
  const latestSession = allSessions[0]
  const allDocuments = patient.documents || []
  const patientDocuments = allDocuments.filter((d: any) => d.doc_type !== 'medical_image')
  const patientImages = allDocuments.filter((d: any) => d.doc_type === 'medical_image')
  const hasDocuments = patientDocuments.length > 0
  const hasImages = patientImages.length > 0
  const latestReport = patient.reports?.[0]
  // Informe por sesión (para el historial de consultas)
  const reportBySession = new Map<string, any>()
  for (const r of (patient.reports || []) as any[]) {
    if (r.session_id && !reportBySession.has(r.session_id)) reportBySession.set(r.session_id, r)
  }
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null
  // Paciente de equipo → hub centrado en sesiones (anamnesis + consultas).
  // Paciente sin equipo → ficha clásica de 5 pasos (intacta).
  const isTeamPatient = !!(patient as any).team_id
  const team = (patient as any).teams as any
  const backHref = isTeamPatient && team ? `/teams/${team.id}` : '/patients'
  // Deporte efectivo: override del paciente → deporte del equipo.
  const patientSportId = (patient as any).sport_id ?? null
  const teamSportName = team?.sports?.name ?? null
  const patientSportName = patientSportId ? ((sports || []).find((s: any) => s.id === patientSportId)?.name ?? null) : null
  const effectiveSportName = patientSportName || teamSportName
  const sportSource = patientSportName ? 'individual' : (teamSportName ? 'equipo' : null)

  // Agrupar consultas por estudio (campaign_id) + individuales (sin estudio).
  const sessionsByCampaign = new Map<string, any[]>()
  const individualSessions: any[] = []
  for (const s of allSessions as any[]) {
    if (s.campaign_id) {
      const arr = sessionsByCampaign.get(s.campaign_id) || []
      arr.push(s)
      sessionsByCampaign.set(s.campaign_id, arr)
    } else {
      individualSessions.push(s)
    }
  }
  const sessionCampaignIds = Array.from(sessionsByCampaign.keys())
  const campaignNames = new Map<string, string>()
  const teamCampaignIds: string[] = []
  // Estudios activos del equipo del paciente (para crear la 1ª consulta desde la ficha)
  if (isTeamPatient && team?.id) {
    const { data: ct } = await supabase
      .from('campaign_teams')
      .select('campaign_id, campaigns(id, name, status)')
      .eq('team_id', team.id)
    for (const row of ct || []) {
      const c = (row as any).campaigns
      if (c && c.status !== 'closed') {
        campaignNames.set(c.id, c.name)
        teamCampaignIds.push(c.id)
      }
    }
  }
  // Nombres de estudios que vienen de sesiones (incluye cerrados con sesiones)
  const missingIds = sessionCampaignIds.filter((id) => !campaignNames.has(id))
  if (isTeamPatient && missingIds.length > 0) {
    const { data: camps } = await supabase.from('campaigns').select('id, name').in('id', missingIds)
    for (const c of camps || []) campaignNames.set(c.id, c.name)
  }
  const blockIds = Array.from(new Set([...sessionCampaignIds, ...teamCampaignIds]))
  const campaignGroups = blockIds.map((id) => ({ id, name: campaignNames.get(id) || 'Estudio', sessions: sessionsByCampaign.get(id) || [] }))

  // Render de un tramo de timeline (reutilizado por grupos e individual)
  const renderTimeline = (sessions: any[]) => (
    <div className="relative">
      {sessions.map((s: any, i: number) => {
        const num = s.session_number || 1
        const type = num === 1 ? 'Valoración inicial' : `Seguimiento ${num - 1}`
        const done = s.status === 'completed'
        const report = reportBySession.get(s.id)
        return (
          <div key={s.id} className="relative pl-8 pb-4 last:pb-0">
            {i < sessions.length - 1 && (
              <span className="absolute left-[9px] top-5 -bottom-4 w-0.5 bg-gray-200" aria-hidden />
            )}
            <span className={`absolute left-0 top-2 w-[18px] h-[18px] rounded-full border-[3px] ${done ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-blue-500'}`} aria-hidden />
            <div className="rounded-xl border border-gray-200 p-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">{type}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {done ? 'Completada' : 'En curso'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 tabular-nums">
                {s.created_at ? new Date(s.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <Link href={`/patients/${patient.id}/sessions/${s.id}`} className="text-xs text-blue-600 font-medium hover:underline">Abrir consulta →</Link>
                {report && (
                  <Link href={`/patients/${patient.id}/report`} className="text-xs text-gray-500 hover:text-blue-600 inline-flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {report.status === 'approved' ? 'Informe aprobado' : 'Borrador de informe'}
                  </Link>
                )}
                <span className="ml-auto"><DeleteSessionButton sessionId={s.id} /></span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href={backHref}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
            title={isTeamPatient && team ? `Volver a ${team.name}` : 'Volver a pacientes'}
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div className="min-w-0">
            {isTeamPatient && team && (
              <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5 truncate">
                <Link href="/groups" className="hover:text-blue-600">Equipos</Link>
                {team.groups?.name && (
                  <>
                    <span>›</span>
                    <Link href={`/groups/${team.group_id}`} className="hover:text-blue-600">{team.groups.name}</Link>
                  </>
                )}
                <span>›</span>
                <Link href={`/teams/${team.id}`} className="hover:text-blue-600 font-medium text-gray-500">{team.name}</Link>
              </nav>
            )}
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && <DeletePatientButton patientId={patient.id} patientName={patient.full_name} />}
          <RefreshButton />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main content - left column */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Anamnesis (pacientes de equipo — obligatoria, aviso no bloqueante) */}
          {isTeamPatient && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Anamnesis</h2>
                {latestAnamnesis?.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Completada</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Pendiente</span>
                )}
              </div>
              {latestAnamnesis?.status !== 'completed' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-1">Cada paciente debe tener su anamnesis rellena. Envíasela para que la complete (recomendado antes de valorar).</p>
              )}
              <AnamnesisActions patientId={patient.id} clinicId={patient.clinic_id} patientName={patient.full_name} currentAnamnesis={latestAnamnesis} />
            </div>
          )}

          {/* Historial de consultas (timeline) */}
          {(isTeamPatient || allSessions.length > 0) && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Historial de consultas</h2>
                {!isTeamPatient && <StartSessionButton patientId={patient.id} label="Nueva consulta" />}
              </div>
              {isTeamPatient ? (
                <div className="space-y-6">
                  {campaignGroups.map((g) => (
                    <div key={g.id}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                          <Megaphone className="w-3.5 h-3.5 text-blue-500" /> {g.name}
                        </h3>
                        <StartSessionButton patientId={patient.id} campaignId={g.id} label="Nueva consulta" />
                      </div>
                      {g.sessions.length > 0 ? renderTimeline(g.sessions) : (
                        <p className="text-xs text-gray-400 pl-1">Sin consultas en este estudio todavía.</p>
                      )}
                    </div>
                  ))}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Consultas individuales</h3>
                      <StartSessionButton patientId={patient.id} label="Nueva consulta" />
                    </div>
                    {individualSessions.length > 0 ? renderTimeline(individualSessions) : (
                      <p className="text-xs text-gray-400">Sin consultas individuales.</p>
                    )}
                  </div>
                </div>
              ) : (
                renderTimeline(allSessions)
              )}
            </div>
          )}

          {/* Proceso del paciente (solo pacientes SIN equipo) */}
          {!isTeamPatient && (
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
                      ? 'Enlace enviado, esperando respuesta — pulsa Actualizar para comprobar'
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
                  latestSession?.status === 'completed'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">2. Valoración del fisio</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {latestSession?.status === 'completed'
                      ? 'Última valoración completada'
                      : latestSession
                      ? 'Valoración en curso'
                      : 'Exploración física + pruebas + dictado por voz'}
                  </p>
                  <div className="mt-2 sm:mt-3 flex items-center gap-2 flex-wrap">
                    {latestSession ? (
                      <>
                        <Link
                          href={`/patients/${patient.id}/sessions/${latestSession.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <Mic className="w-3 h-3" />
                          {latestSession.status === 'completed' ? 'Ver / editar' : 'Continuar'}
                        </Link>
                        <StartSessionButton patientId={patient.id} label="Nueva valoración" />
                      </>
                    ) : (
                      <StartSessionButton patientId={patient.id} label="Iniciar valoración" />
                    )}
                  </div>
                  {allSessions.length > 1 && (
                    <p className="text-[11px] text-gray-400 mt-1.5">{allSessions.length} sesiones</p>
                  )}
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
                      initialInterpretation={patient.vald_interpretation || ''}
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Images (Ultrasound / Photos) */}
              <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  hasImages
                    ? 'bg-green-100 text-green-600'
                    : 'bg-purple-100 text-purple-600'
                }`}>
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">4. Ecografías y fotografías</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {hasImages
                      ? `${patientImages.length} imagen${patientImages.length > 1 ? 'es' : ''} subida${patientImages.length > 1 ? 's' : ''}`
                      : 'Sube ecografías, fotos de lesión o imágenes clínicas'}
                  </p>
                  <div className="mt-2 sm:mt-3">
                    <ImageGallerySection
                      patientId={patient.id}
                      clinicId={patient.clinic_id}
                      initialImages={patientImages}
                    />
                  </div>
                </div>
              </div>

              {/* Step 5: Report */}
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
                  <h3 className="font-medium text-gray-900 text-sm sm:text-base">5. Informe final</h3>
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
          )}
        </div>

        {/* Sidebar - right column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Team card (only for players linked to a team) */}
          {patient.teams && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Equipo</h3>
              <Link
                href={`/teams/${(patient.teams as any).id}`}
                className="flex items-center gap-3 group"
              >
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-blue-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">
                    {(patient.teams as any).name}
                  </p>
                  {(patient.teams as any).category && (
                    <p className="text-xs text-gray-500 truncate">{(patient.teams as any).category}</p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Deporte (override individual) */}
          {(sports || []).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Deporte</h3>
              {isTeamPatient && (
                <p className="text-sm text-gray-800 mb-3">
                  {effectiveSportName ? (
                    <>
                      {effectiveSportName}
                      <span className="text-xs text-gray-400"> · {sportSource === 'equipo' ? 'heredado del equipo' : 'override individual'}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Sin deporte <span className="text-xs">· el equipo no tiene deporte asignado</span></span>
                  )}
                </p>
              )}
              <SportSelect
                table="patients"
                rowId={patient.id}
                currentSportId={patientSportId}
                sports={sports || []}
                label={isTeamPatient ? 'Override del paciente:' : undefined}
              />
              <p className="text-xs text-gray-400 mt-2">
                {isTeamPatient
                  ? `Si lo dejas vacío, usa el deporte del equipo${teamSportName ? ` (${teamSportName})` : ''}.`
                  : 'Override individual (si difiere del equipo).'}
              </p>
            </div>
          )}

          {/* Consentimientos (trazabilidad) */}
          {consents.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Consentimientos</h3>
              <ul className="space-y-2">
                {consents.map((c: any) => (
                  <li key={c.type} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-600 truncate">{consentLabel(c.type)}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className={c.granted ? 'text-green-600' : 'text-red-500'}>
                        {c.granted ? 'Aceptado' : 'Rechazado'}
                      </span>
                      {c.granted_at && (
                        <span className="text-xs text-gray-400">
                          {new Date(c.granted_at).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
