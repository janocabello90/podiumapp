'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Building2, Users, FileText, Save, Plus, Loader2, UserX, UserCheck, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import type { User as UserType, Clinic } from '@/types/database'

type Tab = 'profile' | 'clinic' | 'team' | 'report'

interface Props {
  currentUser: UserType
  currentUserEmail: string
  clinic: Clinic | null
  teamMembers: UserType[]
}

export default function SettingsClient({ currentUser, currentUserEmail, clinic, teamMembers: initialMembers }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const supabase = createClient()

  const tabs = [
    { id: 'profile' as Tab, label: 'Mi perfil', icon: User },
    { id: 'clinic' as Tab, label: 'Clínica', icon: Building2 },
    { id: 'team' as Tab, label: 'Equipo', icon: Users },
    { id: 'report' as Tab, label: 'Informe', icon: FileText },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ajustes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configuración de tu cuenta y la clínica</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-50 text-blue-900'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'profile' && (
        <ProfileSection currentUser={currentUser} currentUserEmail={currentUserEmail} supabase={supabase} />
      )}
      {activeTab === 'clinic' && (
        <ClinicSection clinic={clinic} supabase={supabase} />
      )}
      {activeTab === 'team' && (
        <TeamSection
          teamMembers={initialMembers}
          currentUserId={currentUser.id}
          clinicId={currentUser.clinic_id}
          supabase={supabase}
        />
      )}
      {activeTab === 'report' && (
        <ReportSection clinic={clinic} supabase={supabase} />
      )}
    </div>
  )
}

// ===================== PROFILE =====================
function ProfileSection({ currentUser, currentUserEmail, supabase }: { currentUser: UserType; currentUserEmail: string; supabase: any }) {
  const [fullName, setFullName] = useState(currentUser.full_name)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', currentUser.id)

    if (error) {
      toast.error('Error al guardar')
    } else {
      toast.success('Perfil actualizado')
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-blue-700">
            {fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{fullName}</h3>
          <p className="text-sm text-gray-500">{currentUser.role === 'admin' ? 'Administrador' : 'Fisioterapeuta'}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <input
          type="email"
          value={currentUserEmail}
          disabled
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
        />
        <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar desde aquí</p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || fullName === currentUser.full_name}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar
      </button>
    </div>
  )
}

// ===================== CLINIC =====================
function ClinicSection({ clinic, supabase }: { clinic: Clinic | null; supabase: any }) {
  const [name, setName] = useState(clinic?.name || '')
  const [phone, setPhone] = useState(clinic?.phone || '')
  const [email, setEmail] = useState(clinic?.email || '')
  const [address, setAddress] = useState(clinic?.address || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!clinic) return
    setSaving(true)
    const { error } = await supabase
      .from('clinics')
      .update({ name, phone, email, address })
      .eq('id', clinic.id)

    if (error) {
      toast.error('Error al guardar')
    } else {
      toast.success('Datos de la clínica actualizados')
    }
    setSaving(false)
  }

  if (!clinic) return <p className="text-gray-500">No se encontró la clínica</p>

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la clínica</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección</label>
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar
      </button>
    </div>
  )
}

// ===================== TEAM =====================
function TeamSection({ teamMembers, currentUserId, clinicId, supabase }: {
  teamMembers: UserType[]
  currentUserId: string
  clinicId: string
  supabase: any
}) {
  const [members, setMembers] = useState(teamMembers)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'physio' | 'admin'>('physio')
  const [adding, setAdding] = useState(false)

  async function toggleActive(member: UserType) {
    const newStatus = !member.is_active
    const { error } = await supabase
      .from('users')
      .update({ is_active: newStatus })
      .eq('id', member.id)

    if (error) {
      toast.error('Error al actualizar')
    } else {
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: newStatus } : m))
      toast.success(newStatus ? 'Usuario activado' : 'Usuario desactivado')
    }
  }

  async function handleAddMember() {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Nombre y email son obligatorios')
      return
    }
    setAdding(true)

    try {
      // Note: This creates the user record but the auth user needs to be created
      // separately via Supabase dashboard or an admin API endpoint
      const { data, error } = await supabase
        .from('users')
        .insert({
          clinic_id: clinicId,
          full_name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      setMembers(prev => [...prev, data])
      setNewName('')
      setNewEmail('')
      setShowAdd(false)
      toast.success('Miembro añadido. Recuerda crear su usuario en Supabase Auth.')
    } catch (error: any) {
      toast.error(error.message || 'Error al añadir')
    }
    setAdding(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Equipo ({members.length})</h3>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Añadir
          </button>
        </div>

        {showAdd && (
          <div className="p-4 sm:p-6 border-b border-gray-100 bg-blue-50/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Nombre completo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'physio' | 'admin')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="physio">Fisioterapeuta</option>
                <option value="admin">Administrador</option>
              </select>
              <button
                onClick={handleAddMember}
                disabled={adding}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {adding ? 'Añadiendo...' : 'Guardar'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
            <p className="text-xs text-amber-600">
              ⚠️ También necesitas crear el usuario en Supabase Authentication con el mismo email para que pueda iniciar sesión.
            </p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-4 sm:px-6 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  member.is_active ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <span className={`text-xs font-medium ${member.is_active ? 'text-blue-700' : 'text-gray-400'}`}>
                    {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${member.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {member.full_name}
                    {member.id === currentUserId && <span className="text-xs text-blue-600 ml-1">(tú)</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {member.email} · {member.role === 'admin' ? 'Admin' : 'Fisio'}
                  </p>
                </div>
              </div>

              {member.id !== currentUserId && (
                <button
                  onClick={() => toggleActive(member)}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    member.is_active
                      ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
                      : 'text-green-400 hover:bg-green-50 hover:text-green-600'
                  }`}
                  title={member.is_active ? 'Desactivar' : 'Activar'}
                >
                  {member.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===================== REPORT CUSTOMIZATION =====================
function ReportSection({ clinic, supabase }: { clinic: Clinic | null; supabase: any }) {
  // For now, simple text customization. Could add logo upload later.
  const [footerText, setFooterText] = useState(
    clinic?.address
      ? `${clinic.name} - ${clinic.phone || ''} - ${clinic.address}`
      : 'www.clinicapodium.com - 608392019 - C/ Almagro 16 50004 Zaragoza'
  )
  const [disclaimerText, setDisclaimerText] = useState(
    'Este informe es confidencial y ha sido elaborado para uso exclusivo del paciente mencionado. La información contenida no constituye un diagnóstico médico definitivo, sino una evaluación fisioterapéutica basada en la evidencia disponible al momento de la exploración.'
  )
  const [saved, setSaved] = useState(false)

  function handleSave() {
    // In a real implementation, this would save to a clinic_settings table
    // For now we store in localStorage as a quick solution
    if (typeof window !== 'undefined') {
      localStorage.setItem('podium_report_footer', footerText)
      localStorage.setItem('podium_report_disclaimer', disclaimerText)
    }
    setSaved(true)
    toast.success('Configuración del informe guardada')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-gray-900 mb-1">Personalización del informe</h3>
        <p className="text-xs text-gray-400">Configura los textos que aparecen en el PDF generado</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Pie de página del PDF</label>
        <input
          type="text"
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Aparece al final de cada página del PDF</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Descargo de responsabilidad</label>
        <textarea
          value={disclaimerText}
          onChange={(e) => setDisclaimerText(e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Texto legal que aparece al final del informe</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Logo de la clínica</h4>
        <p className="text-xs text-gray-400">
          Próximamente podrás subir el logo de tu clínica para que aparezca en los informes PDF.
        </p>
      </div>

      <button
        onClick={handleSave}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
      >
        <Save className="w-4 h-4" />
        Guardar configuración
      </button>
    </div>
  )
}
