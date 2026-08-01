import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AnamnesisTemplateEditor from '@/components/settings/AnamnesisTemplateEditor'
import { getAnamnesisTemplateBlocks } from '@/lib/anamnesis/template'
import type { AnamnesisBlock } from '@/components/anamnesis/anamnesisFields'

export const dynamic = 'force-dynamic'

export default async function AnamnesisSettingsPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autenticado</div>

  const { data: profile } = await supabase
    .from('users')
    .select('clinic_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return <div>Perfil no encontrado</div>
  if (profile.role !== 'admin') redirect('/dashboard')

  const clinicId = profile.clinic_id

  // Individual: fila propia o plantilla por defecto del código.
  const individualBlocks = await getAnamnesisTemplateBlocks(supabase, clinicId, 'individual')

  // Equipo: fila propia; si no existe, parte como copia de la individual (decisión de producto).
  const { data: teamRow } = await supabase
    .from('anamnesis_templates')
    .select('blocks')
    .eq('clinic_id', clinicId)
    .eq('audience', 'team')
    .maybeSingle()
  const teamBlocks: AnamnesisBlock[] =
    Array.isArray(teamRow?.blocks) && teamRow!.blocks.length > 0
      ? (teamRow!.blocks as AnamnesisBlock[])
      : individualBlocks

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Formularios de anamnesis</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edita las preguntas que rellenan los pacientes. Hay una plantilla para individuales y otra para equipos.</p>
        </div>
      </div>

      <AnamnesisTemplateEditor
        clinicId={clinicId}
        initialIndividual={individualBlocks}
        initialTeam={teamBlocks}
      />
    </div>
  )
}
