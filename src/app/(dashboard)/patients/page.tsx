import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import PatientList from '@/components/patients/PatientList'

export const dynamic = 'force-dynamic'

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const supabase = createServerSupabaseClient()
  const query = searchParams.q || ''

  let patientsQuery = supabase
    .from('patients')
    .select('*, anamnesis_forms(id, status, created_at), assessments(id, status, created_at), documents(id, doc_type, created_at), reports(id, status, created_at)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (query) {
    patientsQuery = patientsQuery.ilike('full_name', `%${query}%`)
  }

  const { data: patients, error } = await patientsQuery

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {patients?.length || 0} pacientes activos
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
      <div className="relative mb-4 sm:mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <form>
          <input
            name="q"
            type="text"
            defaultValue={query}
            placeholder="Buscar paciente..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </form>
      </div>

      {/* Patient List */}
      <PatientList patients={patients || []} />
    </div>
  )
}
