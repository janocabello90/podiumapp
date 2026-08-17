import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Megaphone, FolderKanban, Shield, CheckCircle2, Loader2 } from 'lucide-react'
import AssessmentForm from '@/components/assessment/AssessmentForm'
import SessionTestsPanel from '@/components/sessions/SessionTestsPanel'
import SessionTestPicker from '@/components/sessions/SessionTestPicker'
import SessionNotes from '@/components/sessions/SessionNotes'
import SportSelect from '@/components/sports/SportSelect'
import DocumentSection from '@/components/documents/DocumentSection'
import ImageGallerySection from '@/components/documents/ImageGallerySection'
import ReportGenerateButton from '@/components/report/ReportGenerateButton'
import { consentLabel } from '@/lib/clinical/consents'
import type { Document } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function SessionPage({ params }: { params: { id: string; sessionId: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>
  const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
  if (!profile) return <div>Perfil no encontrado</div>

  const { data: session } = await supabase
    .from('sessions')
    .select('*, patients(full_name, vald_interpretation, team_id, teams(id, name, group_id, groups(name)))')
    .eq('id', params.sessionId)
    .eq('patient_id', params.id)
    .eq('clinic_id', profile.clinic_id)
    .single()
  if (!session) notFound()

  const [{ data: sessionTests }, { data: sports }, { data: testsCatalog }, { data: anamnesis }, { data: consents }, { data: sessionDocs }, { data: campaign }, { data: existingReport }] = await Promise.all([
    supabase.from('session_tests').select('id, test_id, test_name, status, notes, display_order, is_required').eq('session_id', session.id),
    supabase.from('sports').select('id, name').eq('clinic_id', profile.clinic_id).eq('is_active', true).order('name'),
    supabase.from('tests').select('id, name').eq('clinic_id', profile.clinic_id).eq('is_active', true).order('name'),
    supabase.from('anamnesis_forms').select('status').eq('patient_id', params.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('consents').select('type, granted, granted_at').eq('patient_id', params.id).order('granted_at', { ascending: false }),
    supabase.from('documents').select('*').eq('session_id', session.id).order('created_at', { ascending: false }),
    (session as any).campaign_id
      ? supabase.from('campaigns').select('name').eq('id', (session as any).campaign_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // ¿Ya hay informe generado para ESTA sesión? (el más reciente)
    supabase.from('reports').select('id, status, created_at').eq('session_id', session.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const patient = (session.patients as any) || {}
  const patientName = patient.full_name || ''
  const valdInterpretation = patient.vald_interpretation || ''
  // El PATRÓN de la consulta lo decide si pertenece a un estudio (campaign_id), NO el team_id.
  // Consulta de estudio → patrón de equipo (deporte + pruebas del deporte, contexto del estudio).
  // Consulta individual (aunque el paciente esté en un equipo) → patrón individual
  // (exploración multi-región, ecografías, pruebas del catálogo, sin deporte).
  const isStudySession = !!(session as any).campaign_id
  const team = patient.teams || null
  const groupName = team?.groups?.name as string | undefined
  const campaignName = (campaign as any)?.name as string | undefined
  // Numeración dinámica de secciones (la exploración solo aparece en individuales).
  let step = 0
  const n = () => ++step
  const docs = (sessionDocs || []) as Document[]
  const valdDocs = docs.filter((d) => d.doc_type !== 'medical_image')
  const imageDocs = docs.filter((d) => d.doc_type === 'medical_image')
  const consentsByType = new Map<string, any>()
  for (const c of consents || []) if (!consentsByType.has(c.type)) consentsByType.set(c.type, c)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href={`/patients/${params.id}`} className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Valoración · Sesión {session.session_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {patientName}{session.status === 'completed' ? ' · Completada' : ' · En curso'}
          </p>
        </div>
      </div>

      {/* Contexto del estudio (solo consultas de estudio): estudio · grupo · equipo */}
      {isStudySession && team && (
        <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {campaignName && (
              <span className="inline-flex items-center gap-1.5 text-gray-700">
                <Megaphone className="w-4 h-4 text-blue-500" />
                <span className="text-gray-400">Estudio:</span> <strong className="font-medium">{campaignName}</strong>
              </span>
            )}
            {groupName && (
              <Link href={`/groups/${team.group_id}`} className="inline-flex items-center gap-1.5 text-gray-700 hover:text-blue-600">
                <FolderKanban className="w-4 h-4 text-blue-500" />
                <span className="text-gray-400">Grupo:</span> <strong className="font-medium">{groupName}</strong>
              </Link>
            )}
            <Link href={`/teams/${team.id}`} className="inline-flex items-center gap-1.5 text-gray-700 hover:text-blue-600">
              <Shield className="w-4 h-4 text-blue-500" />
              <span className="text-gray-400">Equipo:</span> <strong className="font-medium">{team.name}</strong>
            </Link>
          </div>
        </div>
      )}

      {/* Deporte de la sesión — solo pacientes de equipo (dirige las pruebas del deporte).
          Los individuales no llevan deporte: eligen las pruebas manualmente. */}
      {isStudySession && (sports || []).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4">
          <SportSelect table="sessions" rowId={session.id} currentSportId={(session as any).sport_id ?? null} sports={sports || []} label="Deporte de la sesión:" />
        </div>
      )}

      {/* Anamnesis + consentimientos */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">{n()}. Anamnesis y consentimientos</h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2 text-sm">
          <p className="text-gray-700">
            Anamnesis: <strong>{anamnesis?.status === 'completed' ? 'completada' : (anamnesis?.status || 'sin iniciar')}</strong>
            {' · '}<Link href={`/patients/${params.id}`} className="text-blue-600 hover:underline">ver en la ficha</Link>
          </p>
          {consentsByType.size > 0 && (
            <ul className="text-xs text-gray-500 space-y-0.5">
              {Array.from(consentsByType.values()).map((c: any) => (
                <li key={c.type}>{consentLabel(c.type)}: <span className={c.granted ? 'text-green-600' : 'text-red-500'}>{c.granted ? 'aceptado' : 'rechazado'}</span></li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Exploración — solo consultas individuales (las de estudio no la usan) */}
      {!isStudySession && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{n()}. Exploración</h2>
          <AssessmentForm
            assessmentId={session.id}
            patientId={params.id}
            initialData={(session.clinical_data as Record<string, any>) || {}}
            initialStatus={session.status || 'in_progress'}
            table="sessions"
            dataColumn="clinical_data"
          />
        </section>
      )}

      {/* Pruebas — equipo: dirigidas por el deporte; individual: elegidas del catálogo */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">{n()}. Pruebas físicas</h2>
        {isStudySession ? (
          <SessionTestsPanel
            sessionId={session.id}
            clinicId={profile.clinic_id}
            sportId={(session as any).sport_id ?? null}
            initialTests={sessionTests || []}
          />
        ) : (
          <SessionTestPicker
            sessionId={session.id}
            clinicId={profile.clinic_id}
            catalog={testsCatalog || []}
            initialSelected={sessionTests || []}
          />
        )}
      </section>

      {/* Informes VALD de la sesión */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">{n()}. Informes VALD</h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <DocumentSection
            patientId={params.id}
            clinicId={profile.clinic_id}
            sessionId={session.id}
            initialDocuments={valdDocs}
            initialInterpretation={valdInterpretation}
          />
        </div>
      </section>

      {/* Imágenes clínicas — solo consultas individuales */}
      {!isStudySession && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{n()}. Ecografías / fotografías</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <ImageGallerySection
              patientId={params.id}
              clinicId={profile.clinic_id}
              sessionId={session.id}
              initialImages={imageDocs}
            />
          </div>
        </section>
      )}

      {/* Anotaciones generales del fisioterapeuta (ambos tipos) */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">{n()}. Anotaciones generales del fisioterapeuta</h2>
        <SessionNotes sessionId={session.id} initialNotes={(session as any).notes || ''} />
      </section>

      {/* Informe individual sobre la sesión */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">{n()}. Informe</h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          {/* Indicador de informe ya generado para esta sesión */}
          {existingReport && existingReport.status === 'generating' ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2 text-sm">
              <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
              <span>Generando informe en segundo plano… Puedes cerrar la página; al volver estará listo.</span>
            </div>
          ) : existingReport && existingReport.status === 'error' ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-3 py-2 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>La última generación falló. Puedes volver a intentarlo.</span>
            </div>
          ) : existingReport ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-3 py-2 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                Informe <strong>{existingReport.status === 'approved' ? 'aprobado' : 'generado (borrador)'}</strong>
                {' · '}
                {new Date(existingReport.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-600">
              {existingReport
                ? 'Ya hay un informe para esta sesión. Puedes revisarlo/aprobarlo o volver a generarlo (creará uno nuevo).'
                : <>Genera el informe IA con el contexto de <strong>esta sesión</strong> ({isStudySession ? 'anamnesis, pruebas, VALD y anotaciones' : 'anamnesis, exploración, pruebas, VALD y anotaciones'}). Tras generarlo, se revisa y aprueba en la ficha.</>}
            </p>
            <div className="flex items-center gap-3 flex-shrink-0">
              <ReportGenerateButton patientId={params.id} sessionId={session.id} hasExisting={!!existingReport} />
              <Link href={`/patients/${params.id}/report`} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg">
                <FileText className="w-3.5 h-3.5" /> Ver / revisar
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
