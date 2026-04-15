import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import PatientList from '@/components/patients/PatientList'
import PatientFilters from '@/components/patients/PatientFilters'
import ClassifyBanner from '@/components/patients/ClassifyBanner'
import { computeStage } from '@/lib/clinical/stage'

export const dynamic = 'force-dynamic'

function ageFromDOB(dob: string | null | undefined): number | null {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function inAgeRange(age: number | null, range: string): boolean {
  if (age === null) return false
  const [min, max] = range.split('-').map(Number)
  return age >= min && age <= max
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: { q?: string; region?: string; pathology?: string; activity?: string; age?: string; gender?: string; stage?: string }
}) {
  const supabase = createServerSupabaseClient()
  const { q, region, pathology, activity, age, gender, stage } = searchParams

  let patientsQuery = supabase
    .from('patients')
    .select('*, anamnesis_forms(id, status, created_at), assessments(id, status, created_at), documents(id, doc_type, created_at), reports(id, status, created_at)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Column-level filters (DB-side, indexed)
  if (q) patientsQuery = patientsQuery.ilike('full_name', `%${q}%`)
  if (region) patientsQuery = patientsQuery.eq('body_region', region)
  if (pathology) patientsQuery = patientsQuery.eq('pathology_tag', pathology)
  if (activity) patientsQuery = patientsQuery.eq('activity_level', activity)
  if (gender) patientsQuery = patientsQuery.eq('gender', gender)

  const { data: rawPatients } = await patientsQuery

  // In-memory filters (derived values)
  let patients = rawPatients || []

  // Count unclassified patients that have data to classify (anamnesis completed OR assessment exists)
  const unclassifiedCount = patients.filter((p: any) => {
    if (p.classified_at) return false
    const hasAnamnesis = (p.anamnesis_forms || []).some((a: any) => a.status === 'completed')
    const hasAssessment = (p.assessments || []).length > 0
    return hasAnamnesis || hasAssessment
  }).length
  if (age) {
    patients = patients.filter((p: any) => inAgeRange(ageFromDOB(p.date_of_birth), age))
  }
  if (stage) {
    patients = patients.filter((p: any) => computeStage(p).key === stage)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} activo{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo paciente</span>
          <span className="sm:hidden">Nuevo</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-3 sm:mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <form>
          <input
            name="q"
            type="text"
            defaultValue={q || ''}
            placeholder="Buscar paciente..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          {region && <input type="hidden" name="region" value={region} />}
          {pathology && <input type="hidden" name="pathology" value={pathology} />}
          {activity && <input type="hidden" name="activity" value={activity} />}
          {age && <input type="hidden" name="age" value={age} />}
          {gender && <input type="hidden" name="gender" value={gender} />}
          {stage && <input type="hidden" name="stage" value={stage} />}
        </form>
      </div>

      {/* AI backfill banner */}
      <ClassifyBanner unclassifiedCount={unclassifiedCount} />

      {/* Filters */}
      <div className="mb-4 sm:mb-6">
        <PatientFilters totalCount={patients.length} />
      </div>

      {/* Patient List */}
      <PatientList patients={patients} />
    </div>
  )
}
