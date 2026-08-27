'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { ANAMNESIS_BLOCKS, isFieldVisible, type AnamnesisField, type AnamnesisBlock } from './anamnesisFields'
import { IMAGE_CHANNELS } from '@/lib/clinical/consents'
import toast from 'react-hot-toast'

interface Props {
  anamnesisId: string
  token: string
  patientName: string
  existingData: Record<string, any>
  existingConsents?: { dataProcessing: boolean; ai: boolean }
  consentTexts?: { data_processing?: string | null; info_treatment?: string | null; ai_analysis?: string | null; image_rights?: string | null; report_sharing_club?: string | null }
  // Plantilla (según el tipo de paciente). Si no llega, se usa la del código.
  blocks?: AnamnesisBlock[]
  // Audiencia: los de equipo (deportistas) ven además el consentimiento de imagen (opcional).
  audience?: 'individual' | 'team'
  // Detección automática de menor por fecha de nacimiento del paciente (Opción C).
  defaultMinor?: boolean
}

export default function AnamnesisFormClient({ anamnesisId, token, patientName, existingData, existingConsents, consentTexts, blocks, audience = 'individual', defaultMinor = false }: Props) {
  const BLOCKS = blocks && blocks.length ? blocks : ANAMNESIS_BLOCKS
  const [currentBlock, setCurrentBlock] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>(existingData)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  // If both consents were already saved in DB, user can skip consent screen on reload
  const preConsented = !!(existingConsents?.dataProcessing && existingConsents?.ai)
  const [consentGiven, setConsentGiven] = useState(preConsented)
  const [consentDataProcessing, setConsentDataProcessing] = useState(existingConsents?.dataProcessing ?? false)
  // `info_treatment` no tiene flag en anamnesis_forms: se siembra de `preConsented`
  // (si ya se consintieron datos+IA, se aceptaron los 3 juntos en la misma pantalla).
  const [consentInfoTreatment, setConsentInfoTreatment] = useState(preConsented)
  const [consentAI, setConsentAI] = useState(existingConsents?.ai ?? false)
  // Derechos de imagen (solo equipos): OPCIONAL, no bloquea. + canales autorizados.
  const showImageConsent = audience === 'team'
  const [consentImageRights, setConsentImageRights] = useState(false)
  const [imageChannels, setImageChannels] = useState<string[]>([])
  // Compartir informe con el club (solo equipos): OPCIONAL (no bloquea el envío).
  const showClubConsent = audience === 'team'
  const [consentReportSharingClub, setConsentReportSharingClub] = useState(false)
  // Nombre del club destinatario (P17), solo equipo. Se guarda en formData con prefijo `_`
  // (autoguardado, sobrevive a recargas). La declaración de veracidad ya es un campo de la
  // plantilla de equipo (bloque "Declaración"), no se duplica aquí.
  const clubRecipient = String(formData._club_recipient || '')
  // Menor de edad (Opción C): auto por fecha de nac. o auto-declarado. Datos del representante
  // legal en formData (con claves `_`, se autoguardan y sobreviven a recargas).
  const [isMinor, setIsMinor] = useState<boolean>(
    existingData?._is_minor !== undefined ? !!existingData._is_minor : defaultMinor
  )
  const repName = String(formData._rep_name || '')
  const repDni = String(formData._rep_dni || '')
  const repRelation = String(formData._rep_relation || '')
  function setRep(key: '_rep_name' | '_rep_dni' | '_rep_relation', value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }
  function toggleMinor(next: boolean) {
    setIsMinor(next)
    setFormData((prev) => ({ ...prev, _is_minor: next }))
  }
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalBlocks = BLOCKS.length
  const block = BLOCKS[currentBlock]
  const fields = block?.fields.filter((f) => isFieldVisible(f, formData)) || []

  const progressPercent = Math.round(((currentBlock) / totalBlocks) * 100)

  // Auto-save
  const autoSave = useCallback(async () => {
    if (Object.keys(formData).length === 0) return
    try {
      await fetch(`/api/anamnesis/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'autosave',
          form_data: formData,
        }),
      })
    } catch (e) {
      console.error('Auto-save error:', e)
    }
  }, [formData, token])

  useEffect(() => {
    const timeout = setTimeout(autoSave, 2000)
    return () => clearTimeout(timeout)
  }, [formData, autoSave])

  function updateField(key: string, value: any) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function nextBlock() {
    if (currentBlock < totalBlocks - 1) {
      setCurrentBlock(currentBlock + 1)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function prevBlock() {
    if (currentBlock > 0) {
      setCurrentBlock(currentBlock - 1)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const isLastBlock = currentBlock === totalBlocks - 1

  async function submitForm() {
    setSaving(true)
    try {
      const res = await fetch(`/api/anamnesis/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          form_data: formData,
          consent_data_processing: consentDataProcessing,
          consent_info_treatment: consentInfoTreatment,
          consent_ai_analysis: consentAI,
          ...(showImageConsent ? { consent_image_rights: consentImageRights, image_channels: imageChannels } : {}),
          ...(showClubConsent ? { consent_report_sharing_club: consentReportSharingClub, club_recipient: clubRecipient } : {}),
          is_minor: isMinor,
          representative: isMinor ? { name: repName, dni: repDni, relation: repRelation } : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al enviar el formulario')
        setSaving(false)
        return
      }
      setCompleted(true)
    } catch (e) {
      console.error('Submit error:', e)
      toast.error('No se pudo enviar el formulario. Revisa tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  // Completed screen
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">¡Ya estamos listos para tu sesión!</h1>
          <p className="text-gray-500 mt-2">
            Hemos revisado tus respuestas antes de que llegues para aprovechar al máximo tu tiempo con nosotros. Nos vemos pronto, {patientName?.split(' ')[0]}!
          </p>
        </div>
      </div>
    )
  }

  // Consent screen
  if (!consentGiven && currentBlock === 0) {
    const minorOk = !isMinor || (repName.trim().length > 0 && repRelation.trim().length > 0)
    const canProceed = consentDataProcessing && consentInfoTreatment && consentAI && minorOk

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-clinical-primary rounded-2xl mb-4">
              <span className="text-xl font-bold text-white">P</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Hola{patientName ? `, ${patientName.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Cuéntanos un poco sobre ti antes de verte. Tardas menos de 5 minutos y nos permite dedicar más tiempo a ti en consulta.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div>
              <h3 className="font-medium text-gray-900 text-sm mb-3">Sobre tus datos</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Tus datos son confidenciales y están protegidos
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Solo tu fisioterapeuta y la clínica tendrán acceso
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Puedes interrumpir y continuar en cualquier momento
                </li>
              </ul>
            </div>

            {/* Menor de edad (Opción C): auto-detectado o auto-declarado */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMinor}
                  onChange={(e) => toggleMinor(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <span className="text-sm text-gray-700">El deportista es <strong>menor de edad</strong> — este formulario lo rellena y firma su representante legal.</span>
              </label>
              {isMinor && (
                <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={repName}
                    onChange={(e) => setRep('_rep_name', e.target.value)}
                    placeholder="Nombre del representante legal *"
                    className="sm:col-span-2 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  />
                  <input
                    value={repDni}
                    onChange={(e) => setRep('_rep_dni', e.target.value)}
                    placeholder="DNI del representante"
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  />
                  <select
                    value={repRelation}
                    onChange={(e) => setRep('_rep_relation', e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  >
                    <option value="">Relación *</option>
                    <option value="Padre">Padre</option>
                    <option value="Madre">Madre</option>
                    <option value="Tutor/a legal">Tutor/a legal</option>
                  </select>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="font-medium text-gray-900 text-sm">Consentimiento informado{isMinor ? ' (otorgado por el representante legal)' : ''}</h3>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentDataProcessing}
                  onChange={(e) => setConsentDataProcessing(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <div className="text-xs text-gray-600 leading-relaxed">
                  {consentTexts?.data_processing ? <ConsentText text={consentTexts.data_processing} /> : (
                    <>Consiento el tratamiento de mis datos de salud por parte de la clínica con la finalidad de realizar mi valoración fisioterapéutica, elaborar un informe clínico y gestionar mi proceso terapéutico. Estos datos se conservarán durante el tiempo necesario para la prestación asistencial y el cumplimiento de obligaciones legales. Puedo ejercer mis derechos de acceso, rectificación, supresión, portabilidad y oposición contactando con la clínica. Más información en la{' '}
                    <a href="/privacidad" target="_blank" className="text-blue-600 underline">política de privacidad</a>.</>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentInfoTreatment}
                  onChange={(e) => setConsentInfoTreatment(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <div className="text-xs text-gray-600 leading-relaxed">
                  {consentTexts?.info_treatment ? <ConsentText text={consentTexts.info_treatment} /> : 'Consiento el tratamiento y la conservación de la información clínica recogida (anamnesis, exploración y pruebas) para el seguimiento de mi proceso asistencial y su uso con fines asistenciales por parte de la clínica.'}
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAI}
                  onChange={(e) => setConsentAI(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <div className="text-xs text-gray-600 leading-relaxed">
                  {consentTexts?.ai_analysis ? <ConsentText text={consentTexts.ai_analysis} /> : 'Consiento que mis datos sean procesados por un sistema de inteligencia artificial (Anthropic Claude, vía API) para generar un borrador de informe clínico. Este borrador será siempre revisado y aprobado por un fisioterapeuta antes de su emisión. El proveedor de IA no almacena ni reutiliza mis datos para entrenar sus modelos.'}
                </div>
              </label>
            </div>

            {/* Compartir con el club (solo equipos) — OPCIONAL */}
            {showClubConsent && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h3 className="font-medium text-gray-900 text-sm">Compartir con el club <span className="text-xs font-normal text-gray-400">· opcional</span></h3>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentReportSharingClub}
                    onChange={(e) => setConsentReportSharingClub(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  />
                  <div className="text-xs text-gray-600 leading-relaxed">
                    {consentTexts?.report_sharing_club ? <ConsentText text={consentTexts.report_sharing_club} /> : 'Autorizo que la Clínica comparta mi informe y/o los resultados de la valoración con mi club y su cuerpo técnico, con fines de seguimiento deportivo.'}
                  </div>
                </label>
                {consentReportSharingClub && (
                  <div className="pl-7">
                    <input
                      value={clubRecipient}
                      onChange={(e) => setFormData((prev) => ({ ...prev, _club_recipient: e.target.value }))}
                      placeholder="Club / entidad destinataria"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Derechos de imagen (solo deportistas de equipo) — OPCIONAL, no bloquea */}
            {showImageConsent && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h3 className="font-medium text-gray-900 text-sm">Derechos de imagen <span className="text-xs font-normal text-gray-400">· opcional</span></h3>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentImageRights}
                    onChange={(e) => { setConsentImageRights(e.target.checked); if (!e.target.checked) setImageChannels([]) }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  />
                  <div className="text-xs text-gray-600 leading-relaxed">
                    {consentTexts?.image_rights ? <ConsentText text={consentTexts.image_rights} /> : 'Autorizo a la clínica a captar, reproducir y difundir mi imagen y/o voz (fotografía, vídeo, testimonio) con fines divulgativos y promocionales. Puedo revocar esta autorización en cualquier momento, con efectos hacia el futuro.'}
                  </div>
                </label>
                {consentImageRights && (
                  <div className="pl-7">
                    <p className="text-xs text-gray-500 mb-2">¿En qué soportes autorizas su difusión?</p>
                    <div className="flex flex-wrap gap-2">
                      {IMAGE_CHANNELS.map((ch) => {
                        const on = imageChannels.includes(ch)
                        return (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => setImageChannels((prev) => on ? prev.filter((c) => c !== ch) : [...prev, ch])}
                            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${on ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                          >
                            {ch}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={async () => {
                if (!canProceed) return
                // Persist consents immediately so reloads don't lose them
                try {
                  await fetch(`/api/anamnesis/${token}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'consent',
                      consent_data_processing: consentDataProcessing,
                      consent_info_treatment: consentInfoTreatment,
                      consent_ai_analysis: consentAI,
                      form_data: formData,
                    }),
                  })
                } catch (e) {
                  console.error('Consent save error:', e)
                }
                setConsentGiven(true)
              }}
              disabled={!canProceed}
              className="w-full py-3 bg-clinical-primary hover:bg-clinical-navy text-white font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Empezar formulario
            </button>

            {!canProceed && (
              <p className="text-xs text-gray-400 text-center">
                {isMinor && !minorOk
                  ? 'Completa los datos del representante legal (nombre y relación) para continuar'
                  : 'Debes aceptar los consentimientos para continuar'}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Check if block is all booleans (for compact grid layout)
  const allBooleans = fields.every(f => f.type === 'boolean')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-100">
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs font-medium text-gray-500">
            {block?.title}
          </span>
          <span className="text-xs text-gray-400">
            {currentBlock + 1} / {totalBlocks}
          </span>
        </div>
      </div>

      {/* Block content - all fields at once */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-20 pb-28">
        <div className="w-full max-w-lg mx-auto">
          {/* Block header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {block?.icon && <span className="mr-2">{block.icon}</span>}
              {block?.title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{block?.description}</p>
          </div>

          {/* Compact boolean grid */}
          {allBooleans ? (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              {fields.map((f) => (
                <BooleanRow
                  key={f.key}
                  field={f}
                  value={formData[f.key]}
                  onChange={(val) => updateField(f.key, val)}
                />
              ))}
            </div>
          ) : (
            /* Regular field list */
            <div className="space-y-6">
              {fields.map((f) => (
                <div key={f.key} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <FieldRenderer
                    field={f}
                    value={formData[f.key]}
                    onChange={(val) => updateField(f.key, val)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={prevBlock}
            disabled={currentBlock === 0}
            className="flex items-center gap-1 px-4 py-2.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-sm rounded-xl transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          {isLastBlock ? (
            <button
              onClick={submitForm}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar formulario'}
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={nextBlock}
              className="flex items-center gap-1 px-6 py-2.5 bg-clinical-primary hover:bg-clinical-navy text-white font-medium text-sm rounded-xl transition-colors"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Compact Boolean Row (for Red Flags, etc.)
// ============================================
function BooleanRow({
  field,
  value,
  onChange,
}: {
  field: AnamnesisField
  value: any
  onChange: (val: any) => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{field.label}</p>
        {field.description && (
          <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === true
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Sí
        </button>
        <button
          onClick={() => onChange(false)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value === false
              ? 'bg-gray-700 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

// ============================================
// Field Renderer Component
// ============================================
function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: AnamnesisField
  value: any
  onChange: (val: any) => void
}) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'tel':
    case 'number':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <input
            type={field.type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      )

    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
        </div>
      )

    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {field.options?.map((option) => (
              <button
                key={option}
                onClick={() => onChange(option)}
                className={`px-4 py-2 rounded-xl border text-sm transition-colors ${
                  value === option
                    ? 'border-blue-500 bg-blue-50 text-clinical-navy font-medium'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )

    case 'multiselect':
      const selected: string[] = value || []
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {field.options?.map((option) => {
              const isSelected = selected.includes(option)
              return (
                <button
                  key={option}
                  onClick={() => {
                    onChange(
                      isSelected
                        ? selected.filter((s) => s !== option)
                        : [...selected, option]
                    )
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-clinical-navy font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      )

    case 'scale':
      const scaleValue = value ?? null
      const minLabel = field.scaleLabels?.min || 'Nada'
      const maxLabel = field.scaleLabels?.max || 'Máximo'
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <div className="flex gap-1.5 justify-center flex-wrap">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
              <button
                key={i}
                onClick={() => onChange(i)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${
                  scaleValue === i
                    ? 'bg-blue-600 text-white shadow-sm'
                    : scaleValue !== null && i <= scaleValue
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400 px-1">
            <span>1 — {minLabel}</span>
            <span>10 — {maxLabel}</span>
          </div>
        </div>
      )

    case 'boolean':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => onChange(true)}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                value === true
                  ? 'border-blue-500 bg-blue-50 text-clinical-navy'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              Sí
            </button>
            <button
              onClick={() => onChange(false)}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                value === false
                  ? 'border-blue-500 bg-blue-50 text-clinical-navy'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              No
            </button>
          </div>
        </div>
      )

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 mb-3">{field.description}</p>
          )}
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      )

    case 'table': {
      const cols = field.columns || []
      const rowsData: Record<string, string>[] = Array.isArray(value) ? value : []
      const rowCount = Math.max(field.rows || 3, rowsData.length + 1)
      const setCell = (r: number, ck: string, v: string) => {
        const next = Array.from({ length: rowCount }, (_, i) => ({ ...(rowsData[i] || {}) }))
        next[r] = { ...next[r], [ck]: v }
        // Descartar filas totalmente vacías al final para no guardar ruido.
        const trimmed = next.filter((row) => Object.values(row).some((x) => String(x || '').trim() !== ''))
        onChange(trimmed)
      }
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1.5">{field.label}</label>
          {field.description && <p className="text-xs text-gray-500 mb-3">{field.description}</p>}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} className="text-left text-xs font-medium text-gray-500 px-1 pb-1">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }).map((_, r) => (
                  <tr key={r}>
                    {cols.map((c) => (
                      <td key={c.key} className="px-1 py-1 align-top">
                        <input
                          value={rowsData[r]?.[c.key] || ''}
                          onChange={(e) => setCell(r, c.key, e.target.value)}
                          className="w-full min-w-[84px] px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

// ============================================
// Consent text renderer — formats a consent body (from consent_versions) nicely:
// heading, "Etiqueta:" en negrita, viñetas reales (separadas por " • ") y párrafos.
// Mismo contenido que el PDF, legible en la app (evita el muro de texto con "•" en línea).
// ============================================
function boldLeadIn(text: string) {
  const idx = text.indexOf(': ')
  if (idx > 1 && idx <= 70) {
    return (
      <>
        <span className="font-semibold text-gray-700">{text.slice(0, idx + 1)}</span>{' '}
        {text.slice(idx + 2)}
      </>
    )
  }
  return text
}

function ConsentText({ text }: { text: string }) {
  const nodes: JSX.Element[] = []
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const idx = line.indexOf(': ')
    const isLabel = idx > 1 && idx <= 66
    if (isLabel) {
      const label = line.slice(0, idx)
      const value = line.slice(idx + 2)
      if (value.includes(' • ')) {
        nodes.push(
          <div key={i}>
            <span className="font-semibold text-gray-700">{label}:</span>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              {value.split(' • ').map((p, j) => (
                <li key={j}>{boldLeadIn(p.trim())}</li>
              ))}
            </ul>
          </div>
        )
      } else {
        nodes.push(
          <p key={i}>
            <span className="font-semibold text-gray-700">{label}:</span> {value}
          </p>
        )
      }
    } else if (!line.includes(':') && line === line.toUpperCase() && line.length > 8) {
      nodes.push(<p key={i} className="font-semibold text-gray-800">{line}</p>)
    } else {
      nodes.push(<p key={i}>{boldLeadIn(line)}</p>)
    }
  })
  return <div className="space-y-1.5">{nodes}</div>
}
