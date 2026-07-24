import { notFound } from 'next/navigation'
import AnamnesisFormClient from '@/components/anamnesis/AnamnesisFormClient'
import { getAnamnesisByToken } from '@/lib/anamnesis/getByToken'

// Siempre server-render fresco (lectura por token en tiempo de request).
export const dynamic = 'force-dynamic'

export default async function AnamnesisPage({
  params,
}: {
  params: { token: string }
}) {
  // Lectura vía service_role (helper), NO con cliente anon.
  // Ya no depende de la policy pública SELECT de anamnesis_forms.
  const anamnesis = await getAnamnesisByToken(params.token)

  if (!anamnesis) {
    notFound()
  }

  // Check if expired
  if (anamnesis.status === 'expired' || (anamnesis.expires_at && new Date(anamnesis.expires_at) < new Date())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⏰</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Enlace expirado</h1>
          <p className="text-gray-500 mt-2">
            Este formulario ya no está disponible. Por favor, contacta con tu clínica para solicitar uno nuevo.
          </p>
        </div>
      </div>
    )
  }

  // Check if already completed
  if (anamnesis.status === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Formulario completado</h1>
          <p className="text-gray-500 mt-2">
            Ya has rellenado este formulario. ¡Gracias! Nos vemos en tu próxima cita.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AnamnesisFormClient
      anamnesisId={anamnesis.id}
      token={params.token}
      patientName={anamnesis.patientName}
      existingData={anamnesis.form_data}
      existingConsents={{
        dataProcessing: anamnesis.consent_data_processing,
        ai: anamnesis.consent_ai_analysis,
      }}
    />
  )
}
