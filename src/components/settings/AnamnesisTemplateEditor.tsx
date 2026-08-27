'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ANAMNESIS_BLOCKS, ANAMNESIS_FIELD_TYPES, type AnamnesisBlock, type AnamnesisField, type AnamnesisFieldType } from '@/components/anamnesis/anamnesisFields'
import { ChevronUp, ChevronDown, Trash2, Plus, Save, RotateCcw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Audience = 'individual' | 'team'

const TYPE_LABELS: Record<AnamnesisFieldType, string> = {
  text: 'Texto corto',
  textarea: 'Texto largo',
  email: 'Email',
  tel: 'Teléfono',
  number: 'Número',
  select: 'Selección (una opción)',
  multiselect: 'Opción múltiple',
  scale: 'Escala 1–10',
  boolean: 'Sí / No',
  date: 'Fecha',
  table: 'Tabla (p. ej. historial de lesiones)',
}

const HAS_OPTIONS: AnamnesisFieldType[] = ['select', 'multiselect']

function shortId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

// Clona en profundidad (los bloques son JSON serializable puro)
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export default function AnamnesisTemplateEditor({
  clinicId,
  initialIndividual,
  initialTeam,
}: {
  clinicId: string
  initialIndividual: AnamnesisBlock[]
  initialTeam: AnamnesisBlock[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [audience, setAudience] = useState<Audience>('individual')
  const [blocksByAudience, setBlocksByAudience] = useState<Record<Audience, AnamnesisBlock[]>>({
    individual: clone(initialIndividual),
    team: clone(initialTeam),
  })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState<Record<Audience, boolean>>({ individual: false, team: false })

  const blocks = blocksByAudience[audience]

  function setBlocks(next: AnamnesisBlock[]) {
    setBlocksByAudience((prev) => ({ ...prev, [audience]: next }))
    setDirty((prev) => ({ ...prev, [audience]: true }))
  }

  // ---- Bloques ----
  function updateBlock(bi: number, patch: Partial<AnamnesisBlock>) {
    const next = clone(blocks)
    next[bi] = { ...next[bi], ...patch }
    setBlocks(next)
  }
  function moveBlock(bi: number, dir: -1 | 1) {
    const j = bi + dir
    if (j < 0 || j >= blocks.length) return
    const next = clone(blocks)
    ;[next[bi], next[j]] = [next[j], next[bi]]
    setBlocks(next)
  }
  function deleteBlock(bi: number) {
    if (!window.confirm('¿Eliminar este bloque y todas sus preguntas?')) return
    setBlocks(blocks.filter((_, i) => i !== bi))
  }
  function addBlock() {
    setBlocks([...clone(blocks), { id: shortId('block'), title: 'Nuevo bloque', description: '', fields: [] }])
  }

  // ---- Preguntas ----
  function updateField(bi: number, fi: number, patch: Partial<AnamnesisField>) {
    const next = clone(blocks)
    next[bi].fields[fi] = { ...next[bi].fields[fi], ...patch }
    setBlocks(next)
  }
  function moveField(bi: number, fi: number, dir: -1 | 1) {
    const j = fi + dir
    const fields = blocks[bi].fields
    if (j < 0 || j >= fields.length) return
    const next = clone(blocks)
    ;[next[bi].fields[fi], next[bi].fields[j]] = [next[bi].fields[j], next[bi].fields[fi]]
    setBlocks(next)
  }
  function deleteField(bi: number, fi: number) {
    const next = clone(blocks)
    next[bi].fields = next[bi].fields.filter((_, i) => i !== fi)
    setBlocks(next)
  }
  function addField(bi: number) {
    const next = clone(blocks)
    next[bi].fields.push({ key: shortId('field'), label: 'Nueva pregunta', type: 'text' })
    setBlocks(next)
  }

  async function save() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('anamnesis_templates')
        .upsert(
          { clinic_id: clinicId, audience, blocks, updated_at: new Date().toISOString() },
          { onConflict: 'clinic_id,audience' }
        )
      if (error) throw error
      setDirty((prev) => ({ ...prev, [audience]: false }))
      toast.success('Plantilla guardada')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar la plantilla')
    } finally {
      setSaving(false)
    }
  }

  function resetToDefault() {
    if (!window.confirm('¿Restablecer esta plantilla a la de por defecto? Se perderán los cambios no guardados de esta sección.')) return
    setBlocks(clone(ANAMNESIS_BLOCKS))
  }

  const totalFields = blocks.reduce((n, b) => n + b.fields.length, 0)

  return (
    <div className="space-y-4">
      {/* Selector de audiencia */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['individual', 'team'] as Audience[]).map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                audience === a ? 'bg-white text-clinical-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {a === 'individual' ? 'Individuales' : 'Equipos'}
              {dirty[a] && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restablecer por defecto
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty[audience]}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar {audience === 'individual' ? 'individuales' : 'equipos'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        {blocks.length} bloque{blocks.length !== 1 ? 's' : ''} · {totalFields} pregunta{totalFields !== 1 ? 's' : ''}.
        Esta es la anamnesis que rellenarán los pacientes {audience === 'individual' ? 'individuales' : 'de equipo'}.
      </p>

      {/* Bloques */}
      <div className="space-y-4">
        {blocks.map((block, bi) => (
          <div key={block.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input
                  value={block.title}
                  onChange={(e) => updateBlock(bi, { title: e.target.value })}
                  placeholder="Título del bloque"
                  className="w-full text-base font-semibold text-gray-900 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
                <input
                  value={block.description || ''}
                  onChange={(e) => updateBlock(bi, { description: e.target.value })}
                  placeholder="Descripción / instrucciones del bloque (opcional)"
                  className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => moveBlock(bi, -1)} disabled={bi === 0} className="p-1.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 rounded"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1} className="p-1.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 rounded"><ChevronDown className="w-4 h-4" /></button>
                <button onClick={() => deleteBlock(bi)} className="p-1.5 text-gray-300 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Preguntas del bloque */}
            <div className="space-y-2 pl-1">
              {block.fields.map((field, fi) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  isFirst={fi === 0}
                  isLast={fi === block.fields.length - 1}
                  hasCondition={!!field.condition}
                  onChange={(patch) => updateField(bi, fi, patch)}
                  onMove={(dir) => moveField(bi, fi, dir)}
                  onDelete={() => deleteField(bi, fi)}
                />
              ))}
              <button
                onClick={() => addField(bi)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 text-xs font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir pregunta
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addBlock}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 border border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 text-sm font-medium rounded-2xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Añadir bloque
        </button>
      </div>
    </div>
  )
}

function FieldRow({
  field,
  isFirst,
  isLast,
  hasCondition,
  onChange,
  onMove,
  onDelete,
}: {
  field: AnamnesisField
  isFirst: boolean
  isLast: boolean
  hasCondition: boolean
  onChange: (patch: Partial<AnamnesisField>) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
}) {
  const showOptions = HAS_OPTIONS.includes(field.type)
  return (
    <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Enunciado de la pregunta"
            className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={field.type}
              onChange={(e) => onChange({ type: e.target.value as AnamnesisFieldType })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-100"
            >
              {ANAMNESIS_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={!!field.required} onChange={(e) => onChange({ required: e.target.checked })} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
              Obligatoria
            </label>
            {hasCondition && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded" title="Esta pregunta solo se muestra según una respuesta anterior. La lógica condicional no se edita aquí (v1).">
                condicional
              </span>
            )}
          </div>
          {showOptions && (
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Opciones (una por línea)</label>
              <textarea
                value={(field.options || []).join('\n')}
                onChange={(e) => onChange({ options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                rows={Math.max(2, (field.options || []).length)}
                placeholder={'Opción A\nOpción B'}
                className="w-full text-xs text-gray-800 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-white resize-y"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => onMove(-1)} disabled={isFirst} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 rounded"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onMove(1)} disabled={isLast} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 rounded"><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  )
}
