import { ANAMNESIS_BLOCKS, type AnamnesisBlock } from '@/components/anamnesis/anamnesisFields'

export type AnamnesisAudience = 'individual' | 'team'

// Devuelve los bloques guardados si existen; si no, la plantilla por defecto del código.
export function resolveBlocks(blocks: unknown): AnamnesisBlock[] {
  return Array.isArray(blocks) && blocks.length > 0 ? (blocks as AnamnesisBlock[]) : ANAMNESIS_BLOCKS
}

// Carga la plantilla de anamnesis para (clínica, audiencia). Acepta cualquier cliente
// Supabase (server autenticado o service_role). Sin fila → plantilla por defecto.
export async function getAnamnesisTemplateBlocks(
  supabase: any,
  clinicId: string,
  audience: AnamnesisAudience
): Promise<AnamnesisBlock[]> {
  const { data } = await supabase
    .from('anamnesis_templates')
    .select('blocks')
    .eq('clinic_id', clinicId)
    .eq('audience', audience)
    .maybeSingle()
  return resolveBlocks(data?.blocks)
}
