import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import AssessmentForm from '@/components/assessment/AssessmentForm'
import SessionTestsPanel from '@/components/sessions/SessionTestsPanel'
import SportSelect from '@/components/sports/SportSelect'
import { consentLabel } from '@/lib/clinical/consents'

export const dynamic = 'force-dynamic'

export default async function SessionPage({ params }: { params: { id: string; sessionId: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>
  const { data: profile } = await supabase.from('users').select('clinic_id').eq('id', user.id).single()
  if (!profile) return <div>Perfil no encontrado</div>

  const { data: session } = await supabase
    .from('sessions')
    .select('*, patients(full_name)')
    .eq('id', params.sessionId)
    .eq('patient_id', params.id)
    .eq('clinic_id', profile.clinic_id)
    .single()
  if (!session) notFound()

  const [{ data: sessionTests }, { data: sports }, { data: anamnesis }, { data: consents }] = await Promise.all([
    supabase.from('session_tests').select('id, test_name, status, notes, display_order, is_required').eq('session_id', session.id),
    supabase.from('sports').select('id, name').eq('clinic_id', profile.clinic_id).eq('is_active', true).order('name'),
    supabase.from('anamnesis_forms').select('status').eq('patient_id', params.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('consents').select('type, granted, granted_at').eq('patient_id', params.id).order('granted_at', { ascending: false }),
  ])

  const patientName = (session.patients as any)?.full_name || ''
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

      {/* Deporte de la sesión */}
      {(sports || []).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4">
          <SportSelect table="sessions" rowId={session.id} currentSportId={(session as any).sport_id ?? null} sports={sports || []} label="Deporte de la sesión:" />
        </div>
      )}

      {/* 1. Anamnesis + consentimientos */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">1. Anamnesis y consentimientos</h2>
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

      {/* 2. Exploración */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">2. Exploración</h2>
        <AssessmentForm
          assessmentId={session.id}
          patientId={params.id}
          initialData={(session.clinical_data as Record<string, any>) || {}}
          initialStatus={session.status || 'in_progress'}
          table="sessions"
          dataColumn="clinical_data"
        />
      </section>

      {/* 3. Pruebas */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">3. Pruebas físicas</h2>
        <SessionTestsPanel
          sessionId={session.id}
          clinicId={profile.clinic_id}
          sportId={(session as any).sport_id ?? null}
          initialTests={sessionTests || []}
        />
      </section>

      {/* 4/5. Documentos e informe (a nivel de ficha en esta fase) */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">4. Documentos e informe</h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-600 flex items-center justify-between gap-3">
          <span>Los PDFs de VALD, imágenes y la generación del informe están en la ficha del paciente.</span>
          <Link href={`/patients/${params.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-medium rounded-lg flex-shrink-0">
            <FileText className="w-3.5 h-3.5" /> Ir a la ficha
          </Link>
        </div>
      </section>
    </div>
  )
}
