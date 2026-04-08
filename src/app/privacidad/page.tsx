import Link from 'next/link'

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
            ← Volver
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-10 space-y-8 text-sm text-gray-700 leading-relaxed">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
            <p className="text-xs text-gray-400">Última actualización: abril 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">1. Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos personales recogidos a través de esta plataforma es
              la clínica de fisioterapia que gestiona su cuenta en Podium App (en adelante, "la Clínica").
              La Clínica opera como responsable del tratamiento conforme al Reglamento (UE) 2016/679 (RGPD)
              y la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).
            </p>
            <p>
              Para ejercer sus derechos o realizar consultas sobre protección de datos, puede contactar directamente
              con la Clínica a través de los datos de contacto facilitados en su comunicación inicial.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">2. Datos que recogemos</h2>
            <p>A través de esta plataforma se recogen las siguientes categorías de datos personales:</p>
            <p>
              <strong>Datos identificativos:</strong> nombre completo, fecha de nacimiento, sexo, datos de contacto (email, teléfono).
            </p>
            <p>
              <strong>Datos de salud (categoría especial):</strong> información proporcionada en el formulario de anamnesis
              (motivo de consulta, síntomas, antecedentes médicos, hábitos, nivel de dolor, impacto funcional, tratamientos previos),
              datos de la exploración física registrados por el fisioterapeuta, informes de valoración funcional (VALD),
              imágenes clínicas (ecografías, fotografías) y el informe de valoración generado.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">3. Finalidades del tratamiento</h2>
            <p>Los datos personales se tratan con las siguientes finalidades:</p>
            <p>
              <strong>Prestación asistencial:</strong> gestionar el proceso de valoración fisioterapéutica,
              elaborar informes clínicos y planificar el tratamiento terapéutico.
            </p>
            <p>
              <strong>Generación de informes mediante IA:</strong> los datos clínicos se procesan a través de un
              sistema de inteligencia artificial (API de Anthropic, modelo Claude) para generar un borrador de
              informe de valoración. Este borrador es siempre revisado, editado y aprobado por un fisioterapeuta
              colegiado antes de su emisión al paciente. El sistema de IA no toma decisiones clínicas autónomas.
            </p>
            <p>
              <strong>Comunicación con el paciente:</strong> envío del informe final y comunicaciones
              relacionadas con el proceso terapéutico.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">4. Base jurídica del tratamiento</h2>
            <p>
              El tratamiento de datos de salud se basa en el <strong>consentimiento explícito</strong> del interesado
              (art. 9.2.a del RGPD), que se recaba de forma granular antes de iniciar el formulario de anamnesis,
              diferenciando entre el consentimiento para el tratamiento de datos con fines asistenciales y el
              consentimiento específico para el procesamiento mediante inteligencia artificial.
            </p>
            <p>
              Adicionalmente, el tratamiento se ampara en la prestación de asistencia sanitaria (art. 9.2.h del RGPD)
              y en el cumplimiento de obligaciones legales aplicables al ámbito sanitario.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">5. Uso de inteligencia artificial</h2>
            <p>
              Esta plataforma utiliza un sistema de inteligencia artificial proporcionado por Anthropic (modelo Claude)
              a través de su API empresarial para asistir en la generación de informes clínicos.
            </p>
            <p>
              <strong>Funcionamiento:</strong> los datos clínicos del paciente (anamnesis, exploración, valoración funcional)
              se envían de forma cifrada al servicio de Anthropic, que genera un borrador de informe estructurado.
              El fisioterapeuta revisa, modifica y aprueba este borrador antes de que se convierta en documento final.
            </p>
            <p>
              <strong>Retención de datos por el proveedor:</strong> según la política de datos de Anthropic para su API,
              los datos enviados no se utilizan para entrenar sus modelos de IA ni se retienen más allá de lo
              estrictamente necesario para generar la respuesta solicitada.
            </p>
            <p>
              <strong>Supervisión humana:</strong> el sistema de IA no toma decisiones autónomas sobre diagnóstico
              ni tratamiento. Todo contenido generado es revisado y aprobado por un profesional sanitario cualificado
              antes de su uso o comunicación al paciente.
            </p>
            <p>
              <strong>Clasificación regulatoria:</strong> el uso del sistema está sujeto al Reglamento (UE) 2024/1689
              de Inteligencia Artificial (RIA). La clasificación de riesgo del sistema y las obligaciones aplicables
              se determinan en colaboración con el servicio de protección de datos de la Clínica.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">6. Destinatarios de los datos</h2>
            <p>Los datos personales pueden ser comunicados a:</p>
            <p>
              <strong>Anthropic PBC</strong> (proveedor de IA): procesamiento de datos para generación de informes,
              sujeto a su política de datos de API y a las garantías de transferencia internacional aplicables.
            </p>
            <p>
              <strong>Supabase Inc.</strong> (infraestructura): almacenamiento y gestión de la base de datos,
              con servidores en la Unión Europea (cuando disponible) o con cláusulas contractuales tipo para
              transferencias internacionales.
            </p>
            <p>
              <strong>Vercel Inc.</strong> (alojamiento web): servicio de hosting de la aplicación.
            </p>
            <p>
              No se ceden datos a terceros con fines comerciales ni publicitarios.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">7. Conservación de los datos</h2>
            <p>
              Los datos personales se conservarán durante el tiempo necesario para la finalidad asistencial
              y, en todo caso, durante los plazos legales exigidos por la normativa sanitaria aplicable.
              En el ámbito sanitario, la Ley 41/2002 establece un periodo mínimo de conservación de la
              historia clínica de 5 años desde la última asistencia.
            </p>
            <p>
              Una vez cumplidos los plazos legales, los datos serán suprimidos o anonimizados.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">8. Derechos del interesado</h2>
            <p>
              Conforme al RGPD, el paciente tiene derecho a:
            </p>
            <p>
              <strong>Acceso:</strong> conocer qué datos personales se están tratando.
              <br />
              <strong>Rectificación:</strong> solicitar la corrección de datos inexactos.
              <br />
              <strong>Supresión:</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios
              para la finalidad para la que fueron recogidos, sin perjuicio de las obligaciones legales de conservación.
              <br />
              <strong>Portabilidad:</strong> recibir sus datos en un formato estructurado y de uso común.
              <br />
              <strong>Oposición:</strong> oponerse al tratamiento de sus datos en determinadas circunstancias.
              <br />
              <strong>Limitación:</strong> solicitar la limitación del tratamiento en los supuestos previstos legalmente.
              <br />
              <strong>Retirada del consentimiento:</strong> retirar el consentimiento en cualquier momento,
              sin que ello afecte a la licitud del tratamiento basado en el consentimiento previo a su retirada.
            </p>
            <p>
              Para ejercer estos derechos, el paciente puede dirigirse a la Clínica a través de los datos
              de contacto proporcionados en su comunicación inicial. También tiene derecho a presentar una
              reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">9. Seguridad de los datos</h2>
            <p>
              Se aplican medidas técnicas y organizativas para garantizar la seguridad de los datos personales,
              incluyendo: cifrado en tránsito (HTTPS/TLS), control de acceso basado en roles, autenticación
              de usuarios, almacenamiento cifrado, y políticas de seguridad a nivel de fila (RLS) en la base de datos
              que garantizan que cada clínica solo puede acceder a los datos de sus propios pacientes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">10. Cookies y almacenamiento local</h2>
            <p>
              Esta plataforma utiliza cookies técnicas estrictamente necesarias para el funcionamiento
              de la autenticación y la sesión de usuario. No se utilizan cookies de seguimiento,
              analítica ni publicidad. El almacenamiento local del navegador se utiliza únicamente
              para preferencias de configuración de la clínica (textos de pie de página e informes).
            </p>
          </section>

          <div className="border-t border-gray-200 pt-6 text-xs text-gray-400">
            <p>
              Podium App — Plataforma de gestión clínica para fisioterapia.
              Esta política de privacidad se actualiza periódicamente para reflejar cambios en el tratamiento de datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
