import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Users,
  FileCheck,
  Clock,
  AlertTriangle,
  ArrowRight,
  Activity as ActivityIcon,
  CalendarClock,
  UserPlus,
  FileText,
  ChevronRight,
  Megaphone,
  Stethoscope,
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

export default async function DashboardPage({ searchParams }: { searchParams: { scope?: string } }) {
  // Por defecto el panel muestra "los míos"; se puede cambiar a toda la clínica con ?scope=clinic
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, clinic_id')
    .eq('id', user.id)
    .single()

  const me = profile?.id
  const cid = profile?.clinic_id
  const firstName = (profile?.full_name || 'Fisio').split(' ')[0]
  const mineOnly = searchParams?.scope !== 'clinic'

  // ===== Pacientes (con relaciones) =====
  const { data: rawPatients } = await supabase
    .from('patients')
    .select(`
      id, full_name, created_by, created_at, updated_at, body_region, pathology_tag, pathology_label,
      anamnesis_forms(id, status, created_at, expires_at, completed_at),
      assessments(id, status, physio_id, created_at, updated_at),
      sessions(id, status, created_at),
      reports(id, status, generated_by, created_at, updated_at)
    `)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  const allPatients = rawPatients || []
  const myPatients = allPatients.filter((p: any) => {
    if (p.created_by === me) return true
    if ((p.assessments || []).some((a: Row) => a.physio_id === me)) return true
    return (p.reports || []).some((r: Row) => r.generated_by === me)
  })
  const scopedPatients = mineOnly ? myPatients : allPatients

  // ===== Estudios activos (estudios) + progreso =====
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, start_date, end_date_planned, groups(name)')
    .eq('clinic_id', cid)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
  const activeCampaigns = campaigns || []
  const campaignIds = activeCampaigns.map((c) => c.id)

  const { data: cts } = campaignIds.length
    ? await supabase.from('campaign_teams').select('campaign_id, team_id, teams(name)').in('campaign_id', campaignIds).eq('clinic_id', cid)
    : { data: [] as any[] }
  const teamsByCampaign = new Map<string, { id: string; name: string }[]>()
  const allTeamIds = new Set<string>()
  for (const ct of cts || []) {
    const arr = teamsByCampaign.get(ct.campaign_id) || []
    arr.push({ id: ct.team_id, name: (ct.teams as any)?.name ?? 'Equipo' })
    teamsByCampaign.set(ct.campaign_id, arr)
    allTeamIds.add(ct.team_id)
  }
  const { data: campPlayers } = allTeamIds.size
    ? await supabase.from('patients').select('id, team_id').in('team_id', Array.from(allTeamIds)).eq('status', 'active').eq('clinic_id', cid)
    : { data: [] as any[] }
  const playersByTeam = new Map<string, string[]>()
  for (const p of campPlayers || []) {
    const arr = playersByTeam.get(p.team_id) || []
    arr.push(p.id)
    playersByTeam.set(p.team_id, arr)
  }
  const { data: campSessions } = campaignIds.length
    ? await supabase.from('sessions').select('patient_id, campaign_id').in('campaign_id', campaignIds).eq('clinic_id', cid)
    : { data: [] as any[] }
  const valuedByCampaign = new Map<string, Set<string>>()
  for (const s of campSessions || []) {
    if (!s.campaign_id) continue
    const set = valuedByCampaign.get(s.campaign_id) || new Set<string>()
    set.add(s.patient_id)
    valuedByCampaign.set(s.campaign_id, set)
  }
  function campProgress(campaignId: string) {
    const teamIds = (teamsByCampaign.get(campaignId) || []).map((t) => t.id)
    const roster = new Set<string>()
    teamIds.forEach((tid) => (playersByTeam.get(tid) || []).forEach((pid) => roster.add(pid)))
    const valuedSet = valuedByCampaign.get(campaignId) || new Set<string>()
    let valued = 0
    roster.forEach((pid) => { if (valuedSet.has(pid)) valued++ })
    return { valued, total: roster.size }
  }

  // ===== Consultas recientes (sesiones) =====
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('id, patient_id, physio_id, session_number, status, created_at, campaign_id, patients(full_name)')
    .eq('clinic_id', cid)
    .order('created_at', { ascending: false })
    .limit(120)
  const sessionsScoped = (recentSessions || []).filter((s: any) => !mineOnly || s.physio_id === me)
  const weekAgo = Date.now() - 7 * ONE_DAY
  const consultas7d = sessionsScoped.filter((s: any) => new Date(s.created_at).getTime() >= weekAgo).length
  const recentConsultas = sessionsScoped.slice(0, 6)

  // ===== KPIs =====
  let draftsToReview = 0
  for (const p of scopedPatients as any[]) {
    for (const r of (p.reports || []) as Row[]) {
      if (r.status !== 'draft') continue
      if (mineOnly && r.generated_by !== me) continue
      draftsToReview++
    }
  }

  // ===== Alertas (scope-aware) =====
  type Alert = { id: string; patientId: string; patientName: string; kind: string; message: string; days: number }
  const alerts: Alert[] = []
  for (const p of scopedPatients as any[]) {
    const lastAnamnesis = (p.anamnesis_forms || []).sort((a: Row, b: Row) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0]
    if (lastAnamnesis?.status === 'expired') {
      alerts.push({ id: `${p.id}-exp`, patientId: p.id, patientName: p.full_name, kind: 'expired_anamnesis', message: 'Anamnesis expirada', days: daysSince(lastAnamnesis.expires_at) })
    }
    for (const a of (p.assessments || []).filter((a: Row) => a.status === 'in_progress' && (!mineOnly || a.physio_id === me)) as Row[]) {
      const d = daysSince(a.updated_at || a.created_at)
      if (d >= 7) alerts.push({ id: `${p.id}-ass-${a.id}`, patientId: p.id, patientName: p.full_name, kind: 'stale_assessment', message: `Valoración abierta hace ${d} días`, days: d })
    }
    for (const r of (p.reports || []).filter((r: Row) => r.status === 'draft' && (!mineOnly || r.generated_by === me)) as Row[]) {
      const d = daysSince(r.updated_at || r.created_at)
      if (d >= 3) alerts.push({ id: `${p.id}-draft-${r.id}`, patientId: p.id, patientName: p.full_name, kind: 'stale_draft', message: `Borrador sin aprobar (${d} días)`, days: d })
    }
  }
  alerts.sort((a, b) => b.days - a.days)
  const topAlerts = alerts.slice(0, 8)

  // ===== Distribución por etapa =====
  const stageCounts = new Map<string, { label: string; count: number }>()
  for (const p of scopedPatients as any[]) {
    const s = computeStage(p)
    const e = stageCounts.get(s.key)
    if (e) e.count++
    else stageCounts.set(s.key, { label: s.label, count: 1 })
  }
  const distribution = Array.from(stageCounts.values()).sort((a, b) => b.count - a.count)
  const maxCount = Math.max(1, ...distribution.map((d) => d.count))

  const scopeLabel = mineOnly ? 'Míos' : 'Toda la clínica'

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header + scope toggle */}
      <div className="flex items-end justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Hola, {firstName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Panel de {scopeLabel.toLowerCase()} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
          <Link href="/dashboard" className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mineOnly ? 'bg-white text-clinical-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Míos</Link>
          <Link href="/dashboard?scope=clinic" className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!mineOnly ? 'bg-white text-clinical-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Toda la clínica</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard label="Estudios activos" value={activeCampaigns.length} icon={Megaphone} color="blue" href="/estudios" />
        <KpiCard label="Consultas · 7 días" value={consultas7d} icon={Stethoscope} color="emerald" />
        <KpiCard label="Informes por revisar" value={draftsToReview} icon={FileCheck} color="amber" emphasize={draftsToReview > 0} />
        <KpiCard label={mineOnly ? 'Mis pacientes activos' : 'Pacientes activos'} value={scopedPatients.length} icon={Users} color="violet" href="/patients" />
      </div>

      {/* Estudios activos */}
      {activeCampaigns.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Megaphone className="w-4 h-4 text-blue-500" /> Estudios activos</h3>
            <Link href="/estudios" className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">Ver todos <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.slice(0, 3).map((c: any) => {
              const { valued, total } = campProgress(c.id)
              const pct = total > 0 ? Math.round((valued / total) * 100) : 0
              return (
                <Link key={c.id} href={`/estudios/${c.id}`} className="bg-white rounded-2xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                  <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{(c.groups as any)?.name || '—'}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-clinical-navy" style={{ width: `${pct}%` }} /></div>
                    <span className="text-xs font-semibold text-gray-700 tabular-nums font-mono">{valued}/{total}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Alertas + Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Alertas</h3>
            {topAlerts.length > 0 && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{alerts.length}</span>}
          </div>
          {topAlerts.length === 0 ? (
            <div className="px-4 sm:px-5 py-8 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 mb-2"><FileCheck className="w-5 h-5 text-emerald-600" /></div>
              <p className="text-sm text-gray-500">Sin alertas. Todo al día.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {topAlerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/patients/${a.patientId}`} className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <AlertIcon kind={a.kind} />
                      <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{a.patientName}</p><p className="text-xs text-gray-500 truncate">{a.message}</p></div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

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
                  <div className="flex items-center justify-between text-xs mb-1"><span className="text-gray-600 truncate">{d.label}</span><span className="text-gray-400 flex-shrink-0 ml-2 tabular-nums">{d.count}</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(d.count / maxCount) * 100}%` }} /></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Consultas recientes */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2"><Stethoscope className="w-4 h-4 text-blue-500" /><h3 className="font-semibold text-gray-900 text-sm">Consultas recientes</h3></div>
          <Link href="/patients" className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">Ver pacientes <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {recentConsultas.length === 0 ? (
          <div className="px-4 sm:px-5 py-10 text-center">
            <p className="text-sm text-gray-500 mb-3">Aún no hay consultas registradas.</p>
            <Link href="/patients/new" className="inline-flex items-center gap-1.5 px-3 py-2 bg-clinical-primary hover:bg-clinical-navy text-white text-xs font-medium rounded-lg transition-colors"><UserPlus className="w-3.5 h-3.5" /> Nuevo paciente</Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentConsultas.map((s: any) => {
              const name = (s.patients as any)?.full_name || 'Paciente'
              const num = s.session_number || 1
              const type = num === 1 ? 'Valoración inicial' : `Seguimiento ${num - 1}`
              const done = s.status === 'completed'
              return (
                <li key={s.id}>
                  <Link href={`/patients/${s.patient_id}/sessions/${s.id}`} className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-xs font-medium text-blue-700">{name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</span></div>
                      <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{name}</p><p className="text-xs text-gray-500 truncate">{type}{s.campaign_id ? ' · en estudio' : ''}</p></div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 tabular-nums font-mono hidden sm:inline">{new Date(s.created_at).toLocaleDateString('es-ES')}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        <span className="hidden sm:inline">{done ? 'Completada' : 'En curso'}</span>
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// =============================================================

function KpiCard({ label, value, icon: Icon, color, emphasize = false, href }: { label: string; value: number; icon: any; color: 'blue' | 'amber' | 'emerald' | 'violet'; emphasize?: boolean; href?: string }) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  }
  const c = colorMap[color]
  const inner = (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center`}><Icon className={`w-4 h-4 ${c.text}`} /></div>
        {href && <ChevronRight className="w-4 h-4 text-gray-300" />}
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </>
  )
  const cls = `block bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 ${emphasize && value > 0 ? `ring-2 ${c.ring}` : ''} ${href ? 'hover:border-blue-300 transition-colors' : ''}`
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>
}

function AlertIcon({ kind }: { kind: string }) {
  const map: Record<string, { icon: any; bg: string; text: string }> = {
    expired_anamnesis: { icon: AlertTriangle, bg: 'bg-red-50', text: 'text-red-600' },
    stale_assessment: { icon: Clock, bg: 'bg-amber-50', text: 'text-amber-600' },
    stale_draft: { icon: FileText, bg: 'bg-amber-50', text: 'text-amber-600' },
    inactive_post_report: { icon: CalendarClock, bg: 'bg-blue-50', text: 'text-blue-600' },
  }
  const { icon: Icon, bg, text } = map[kind] || map.stale_assessment
  return <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-4 h-4 ${text}`} /></div>
}
