'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Bell } from 'lucide-react'

const SECTION: Record<string, string> = {
  dashboard: 'Inicio',
  patients: 'Pacientes',
  campaigns: 'Estudios',
  groups: 'Equipos',
  teams: 'Equipos',
  reports: 'Informes',
  activity: 'Actividad',
  settings: 'Configuración',
}

export default function TopBar({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  const pathname = usePathname()
  const seg = pathname.split('/').filter(Boolean)[0] || 'dashboard'
  const section = SECTION[seg] || 'Inicio'
  const initials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="hidden lg:flex sticky top-0 z-30 h-16 items-center gap-4 px-8 bg-clinical-bg/85 backdrop-blur border-b border-gray-200">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm flex-shrink-0">
        <span className="text-gray-400">Clínica</span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium">{section}</span>
      </nav>

      {/* Global search (lleva a la lista de pacientes, donde se busca) */}
      <Link
        href="/patients"
        className="ml-2 flex items-center gap-2 text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-3.5 py-2 w-full max-w-sm hover:border-gray-300 transition-colors"
      >
        <Search className="w-4 h-4" />
        Buscar paciente o estudio…
      </Link>

      {/* Right: alerts + user */}
      <div className="ml-auto flex items-center gap-3 flex-shrink-0">
        <Link
          href="/dashboard"
          title="Alertas"
          className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-clinical-primary hover:border-gray-300 transition-colors"
        >
          <Bell className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2.5 pl-1">
          <div className="text-right leading-tight">
            <p className="text-xs font-semibold text-gray-900">{userName}</p>
            <p className="text-[10px] font-mono uppercase tracking-wide text-gray-400">{roleLabel}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-clinical-soft text-clinical-navy flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
