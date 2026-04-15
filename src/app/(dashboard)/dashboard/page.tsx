import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Users,
  FileCheck,
  Clock,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Activity as ActivityIcon,
  CalendarClock,
  UserPlus,
  FileText,
  ChevronRight,
} from 'lucide-react'
import { computeStage } from '@/lib/clinical/stage'
import { getRegionLabel, getPathologyLabel } from '@/lib/clinical/taxonomy'

export const dynamic = 'force-dynamic'

type Row = { id: string; status?: string | null; created_at?: string; updated_at?: string; expires_at?: string | null; physio_id?: string; generated_by?: string | null }

const ONE_DAY = 24 * 60 * 60 * 1000

function daysSince(iso?: string | null): number {
  if (!iso) return Infinity
  return Math.floor((Date.now() - new Date(iso).getTime()) / ONE_DAY)
}

function startOfWeek(): number {
  const now = new Date()
  const day = now.getDay() // 0 Sun .. 6 Sat
  const diff = day === 0 ? 6 : day - 1 // Monday as week start
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.getTime()
}

function startOfMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div>No autenticado</div>
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, clinic_id')
    .eq('id', user.id)
    .single()

  const me = profile?.id
  const firstName = (profile?.full_name || 'Fisio').split(' ')[0]

  // Fetch all active patients with relations
  const { data: rawPatients } = await supabase
    .from('patients')
    .select(`
      id, full_name, created_by, created_at, updated_at, body_region, pathology_tag, pathology_label,
      anamnesis_forms(id, status, created_at, expires_at, completed_at),
      assessments(id, status, physio_id, created_at, updated_at),
      documents(id, doc_type, created_at),
      reports(id, status, generated_by, created_at, updated_at)
    `)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  const allPatients = rawPatients || []

  // Derive "mis pacientes": any touch by me (created_by, assessment.physio_id, report.generated_by)
  const myPatients = allPatients.filter((p: any) => {
    if (p.created_by === me) return true
    const touchedAssessment = (p.assessments || []).some((a: Row) => a.physio_id === me)
    if (touchedAssessment) return true
    const touchedReport = (p.reports || []).some((r: Row) => r.generated_by === me)
    return touchedReport
  })

  // === KPIs ===
  const weekStart = startOfWeek()
  const monthStart = startOfMonth()

  const myActiveCount = myPatients.length
  const newThisWeek = myPatients.filter((p: any) => new Date(p.created_at).getTime() >= weekStart).length

  // Reports approved by me this month (from all patients, not just mine, in case approver differs)
  let approvedThisMonth = 0
  for (const p of allPatients as any[]) {
    for (const r of (p.reports || []) as Row[]) {
      if (r.generated_by !== me) continue
      if (r.status !== 'approved' && r.status !== 'sent') continue
      const t = new Date(r.updated_at || r.created_at || 0).getTime()
      if (t >= monthStart) approvedThisMonth++
    }
  }

  // "Pendientes de acción mía" = stages that need follow-up
  const actionableStages = new Set([
    'anamnesis_expired',
    'anamnesis_pending',
    'anamnesis_progress',
    'assessment_progress',
    'assessment_done',
    'report_draft',
  ])
  const pendingCount = myPatients.filter((p: any) => actionableStages.has(computeStage(p).key)).length

  // === Alerts ===
  type Alert = {
    id: string
    patientId: string
    patientName: string
    kind: 'expired_anamnesis' | 'stale_assessment' | 'stale_draft' | 'inactive_post_report'
    message: string
    days: number
  }
  const alerts: Alert[] = []

  for (const p of myPatients as any[]) {
    // 1. Anamnesis expired
    const lastAnamnesis = (p.anamnesis_forms || []).sort((a: Row, b: Row) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )[0]
    if (lastAnamnesis?.status === 'expired') {
      alerts.push({
        id: `${p.id}-exp-anam`,
        patientId: p.id,
        patientName: p.full_name,
        kind: 'expired_anamnesis',
        message: 'Anamnesis expirada',
        days: daysSince(lastAnamnesis.expires_at),
      })
    }

    // 2. Assessment in progress > 7 days
    const openAssessments = (p.assessments || []).filter((a: Row) => a.status === 'in_progress' && a.physio_id === me)
    for (const a of openAssessments as Row[]) {
      const d = daysSince(a.updated_at || a.created_at)
      if (d >= 7) {
        alerts.push({
          id: `${p.id}-stale-ass-${a.id}`,
          patientId: p.id,
          patientName: p.full_name,
          kind: 'stale_assessment',
          message: `Valoración abierta hace ${d} días`,
          days: d,
        })
      }
    }

    // 3. Report draft > 3 days
    const drafts = (p.reports || []).filter((r: Row) => r.status === 'draft' && r.generated_by === me)
    for (const r of drafts as Row[]) {
      const d = daysSince(r.updated_at || r.created_at)
      if (d >= 3) {
        alerts.push({
          id: `${p.id}-draft-${r.id}`,
          patientId: p.id,
          patientName: p.full_name,
          kind: 'stale_draft',
          message: `Borrador sin aprobar (${d} días)`,
          days: d,
        })
      }
    }

    // 4. Approved report > 30 days, no subsequent activity
    const approved = (p.reports || [])
      .filter((r: Row) => (r.status === 'approved' || r.status === 'sent') && r.generated_by === me)
      .sort((a: Row, b: Row) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0]
    if (approved) {
      const d = daysSince(approved.updated_at || approved.created_at)
      const lastTouch = new Date(p.updated_at).getTime()
      const approvedAt = new Date(approved.updated_at || approved.created_at || 0).getTime()
      // Only alert if there has been no newer touch after approval
      if (d >= 30 && lastTouch <= approvedAt + 2 * ONE_DAY) {
        alerts.push({
          id: `${p.id}-inactive-${approved.id}`,
          patientId: p.id,
          patientName: p.full_name,
          kind: 'inactive_post_report',
          message: `Sin actividad desde informe (${d} días)`,
          days: d,
        })
      }
    }
  }

  // Sort alerts: most urgent first
  alerts.sort((a, b) => b.days - a.days)
  const topAlerts = alerts.slice(0, 8)

  // === Stage distribution ===
  const stageCounts = new Map<string, { label: string; count: number; color: string }>()
  for (const p of myPatients as any[]) {
    const s = computeStage(p)
    const existing = stageCounts.get(s.key)
    if (existing) existing.count++
    else stageCounts.set(s.key, { label: s.label, count: 1, color: s.bg + ' ' + s.text })
  }
  const distribution = Array.from(stageCounts.values()).sort((a, b) => b.count - a.count)
  const maxCount = Math.max(1, ...distribution.map(d => d.count))

  // === Recent "mis pacientes" (last 6) ===
  const recent = [...myPatients].slice(0, 6)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Hola, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tu panel de control para hoy</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          label="Mis pacientes activos"
          value={myActiveCount}
          icon={Users}
          color="blue"
        />
        <KpiCard
          label="Pendientes de acción"
          value={pendingCount}
          icon={Clock}
          color="amber"
          emphasize={pendingCount > 0}
        />
        <KpiCard
          label="Nuevos esta semana"
          value={newThisWeek}
          icon={UserPlus}
          color="emerald"
        />
        <KpiCard
          label="Informes aprobados (mes)"
          value={approvedThisMonth}
          icon={FileCheck}
          color="violet"
        />
      </div>

      {/* Alerts + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Alerts */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Alertas</h3>
              {topAlerts.length > 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
          </div>
          {topAlerts.length === 0 ? (
            <div className="px-4 sm:px-5 py-8 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 mb-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm text-gray-500">Sin alertas. Todo al día.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {topAlerts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/patients/${a.patientId}`}
                    className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AlertIcon kind={a.kind} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.patientName}</p>
                        <p className="text-xs text-gray-500 truncate">{a.message}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Distribución por etapa</h3>
          </div>
          <div className="px-4 sm:px-5 py-4 space-y-2.5">
            {distribution.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin pacientes todavía.</p>
            ) : (
              distribution.map((d) => (
                <div key={d.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 truncate">{d.label}</span>
                    <span className="text-gray-400 flex-shrink-0 ml-2">{d.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(d.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mis pacientes recientes */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Mis pacientes recientes</h3>
          </div>
          <Link
            href="/patients"
            className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
          >
            Ver todos
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 sm:px-5 py-10 text-center">
            <p className="text-sm text-gray-500 mb-3">
              Aún no tienes pacientes asignados.
            </p>
            <Link
              href="/patients/new"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nuevo paciente
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recent.map((p: any) => {
              const stage = computeStage(p)
              const Icon = stage.icon
              const clinicalLine = [
                getRegionLabel(p.body_region),
                p.pathology_label || getPathologyLabel(p.pathology_tag),
              ].filter(Boolean).join(' · ')

              return (
                <li key={p.id}>
                  <Link
                    href={`/patients/${p.id}`}
                    className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-blue-700">
                          {p.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.full_name}</p>
                        {clinicalLine && (
                          <p className="text-xs text-gray-500 truncate">{clinicalLine}</p>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${stage.bg} ${stage.text} flex-shrink-0 ml-2`}>
                      <Icon className="w-3 h-3" />
                      <span className="hidden sm:inline">{stage.shortLabel}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Seguimiento placeholder */}
      <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 border border-indigo-100 rounded-2xl px-4 sm:px-6 py-5 flex items-start gap-3">
        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Seguimiento de pacientes</h3>
          <p className="text-xs text-gray-500 mb-2">
            Aquí tendrás un control tipo cartera de clientes: tareas recurrentes, próximas revisiones, notas y check-ins.
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
            <Sparkles className="w-3 h-3" />
            Próximamente
          </span>
        </div>
      </div>
    </div>
  )
}

// =============================================================

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  emphasize = false,
}: {
  label: string
  value: number
  icon: any
  color: 'blue' | 'amber' | 'emerald' | 'violet'
  emphasize?: boolean
}) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-100' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-100' },
  }
  const c = colorMap[color]

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 ${
        emphasize && value > 0 ? `ring-2 ${c.ring}` : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function AlertIcon({ kind }: { kind: string }) {
  const map: Record<string, { icon: any; bg: string; text: string }> = {
    expired_anamnesis:    { icon: AlertTriangle,  bg: 'bg-red-50',    text: 'text-red-600'    },
    stale_assessment:     { icon: Clock,          bg: 'bg-amber-50',  text: 'text-amber-600'  },
    stale_draft:          { icon: FileText,       bg: 'bg-amber-50',  text: 'text-amber-600'  },
    inactive_post_report: { icon: CalendarClock,  bg: 'bg-blue-50',   text: 'text-blue-600'   },
  }
  const { icon: Icon, bg, text } = map[kind] || map.stale_assessment
  return (
    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-4 h-4 ${text}`} />
    </div>
  )
}
