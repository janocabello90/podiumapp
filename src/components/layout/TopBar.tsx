'use client'

import { usePathname } from 'next/navigation'

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

export default function TopBar() {
  const pathname = usePathname()
  const seg = pathname.split('/').filter(Boolean)[0] || 'dashboard'
  const section = SECTION[seg] || 'Inicio'

  return (
    <header className="hidden lg:flex sticky top-0 z-30 h-14 items-center px-8 bg-clinical-bg/85 backdrop-blur border-b border-gray-200">
      <nav className="flex items-center gap-1.5 text-sm">
        <span className="text-gray-400">Clínica</span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium">{section}</span>
      </nav>
    </header>
  )
}
