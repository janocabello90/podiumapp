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
              FISIO ZARAGOZA, S.L.P. (en adelante, &ldquo;la Clínica&rdquo;), en cumplimiento de lo establecido
              en el Reglamento General de Protección de Datos (RGPD 2016/679) y la Ley Orgánica 3/2018
              de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), informa
              a los usuarios de esta plataforma:
            </p>
            <p>
              <strong>Denominación:</strong> FISIO ZARAGOZA, S.L.P.
              <br />
              <strong>CIF:</strong> B99562720
              <br />
              <strong>Domicilio:</strong> c/ Almagro, nº 16, Local, 50004 Zaragoza
              <br />
              <strong>Teléfono:</strong> 647 974 924
              <br />
              <strong>Email protección de datos:</strong>{' '}
              <a href="mailto:rgpd@fisiozaragoza.com" className="text-blue-600 hover:text-blue-800">
                rgpd@fisiozaragoza.com
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">2. Delegado de Protección de Datos</h2>
            <p>
              FISIO ZARAGOZA, S.L.P. ha nombrado como Delegado de Protección de Datos a
              EXPLOTACIÓN DE SOFTWARE INTEGRAL S.L. En caso de cualquier duda o consulta sobre el tratamiento
              de sus datos de carácter personal, puede contactar con el Delegado a través del email{' '}
              <a href="mailto:rgpd@fisiozaragoza.com" className="text-blue-600 hover:text-blue-800">
                rgpd@fisiozaragoza.com
              </a>
              , indicando el motivo de la consulta o solicitud.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">3. Datos que recogemos</h2>
            <p>A través de esta plataforma se recogen las siguientes categorías de datos personales:</p>
            <p>
              <strong>Datos identificativos:</strong> nombre completo, fecha de nacimiento, sexo, datos
              de contacto (email, teléfono).
            </p>
            <p>
              <strong>Datos de salud (categoría especial del art. 9 RGPD):</strong> información proporcionada
              en el formulario de anamnesis (motivo de consulta, síntomas, antecedentes médicos, hábitos,
              nivel de dolor, impacto funcional, tratamientos previos), datos de la exploración física
              registrados por el fisioterapeuta, informes de valoración funcional (VALD), imágenes clínicas
              (ecografías, fotografías) y el informe de valoración generado.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">4. Finalidades del tratamiento</h2>
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
            <h2 className="text-lg font-semibold text-gray-900">5. Base jurídica del tratamiento</h2>
            <p>
              El tratamiento de datos de salud se basa en el <strong>consentimiento explícito</strong> del
              interesado (art. 9.2.a del RGPD), que se recaba de forma granular antes de iniciar el formulario
              de anamnesis, diferenciando entre el consentimiento para el tratamiento de datos con fines
              asistenciales y el consentimiento específico para el procesamiento mediante inteligencia artificial.
            </p>
            <p>
              Adicionalmente, el tratamiento se ampara en la prestación de asistencia sanitaria (art. 9.2.h
              del RGPD) y en el cumplimiento de obligaciones legales aplicables al ámbito sanitario.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">6. Uso de inteligencia artificial</h2>
            <p>
              Esta plataforma utiliza un sistema de inteligencia artificial proporcionado por Anthropic
              (modelo Claude) a través de su API empresarial para asistir en la generación de informes clínicos.
            </p>
            <p>
              <strong>Funcionamiento:</strong> los datos clínicos del paciente (anamnesis, exploración, valoración
              funcional) se envían de forma cifrada al servicio de Anthropic, que genera un borrador de informe
              estructurado. El fisioterapeuta revisa, modifica y aprueba este borrador antes de que se convierta
              en documento final.
            </p>
            <p>
              <strong>Retención de datos por el proveedor:</strong> según la política de datos de Anthropic
              para su API, los datos enviados no se utilizan para entrenar sus modelos de IA ni se retienen
              más allá de lo estrictamente necesario para generar la respuesta solicitada.
            </p>
            <p>
              <strong>Supervisión humana:</strong> el sistema de IA no toma decisiones autónomas sobre diagnóstico
              ni tratamiento. Todo contenido generado es revisado y aprobado por un profesional sanitario
              cualificado antes de su uso o comunicación al paciente.
            </p>
            <p>
              <strong>Clasificación regulatoria:</strong> el uso del sistema está sujeto al Reglamento (UE)
              2024/1689 de Inteligencia Artificial (RIA). La clasificación de riesgo del sistema y las
              obligaciones aplicables se determinan en colaboración con el Delegado de Protección de Datos.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">7. Destinatarios de los datos</h2>
            <p>
              No se prevén cesiones de datos a excepción de las autorizadas por la legislación fiscal,
              mercantil y sanitaria, así como en aquellos casos en los que una autoridad judicial lo requiera.
            </p>
            <p>
              FISIO ZARAGOZA, S.L.P. puede compartir datos personales con los siguientes encargados de
              tratamiento, con los que se ha formalizado el correspondiente contrato conforme al art. 28 del RGPD:
            </p>
            <p>
              <strong>Anthropic PBC</strong> (proveedor de IA): procesamiento de datos para generación de informes,
              sujeto a su política de datos de API y a las garantías de transferencia internacional aplicables.
            </p>
            <p>
              <strong>Supabase Inc.</strong> (infraestructura): almacenamiento y gestión de la base de datos,
              con servidores en la Unión Europea cuando esté disponible o con cláusulas contractuales tipo
              para transferencias internacionales.
            </p>
            <p>
              <strong>Vercel Inc.</strong> (alojamiento web): servicio de hosting de la aplicación.
            </p>
            <p>
              <strong>OpenAI</strong> (transcripción de voz): únicamente para convertir audio en texto
              durante el dictado clínico; el audio no se almacena tras la transcripción.
            </p>
            <p>No se ceden datos a terceros con fines comerciales ni publicitarios.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">8. Conservación de los datos</h2>
            <p>
              Los datos personales se conservarán durante el tiempo necesario para la finalidad asistencial
              y, en todo caso, durante los plazos legales exigidos por la normativa sanitaria aplicable.
              En el ámbito sanitario, la Ley 41/2002 establece un periodo mínimo de conservación de la
              historia clínica de 5 años desde la última asistencia.
            </p>
            <p>Una vez cumplidos los plazos legales, los datos serán suprimidos o anonimizados.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">9. Elaboración de perfiles</h2>
            <p>
              No se tomarán decisiones automatizadas con efectos jurídicos sobre el paciente ni se elaborarán
              perfiles comerciales. El procesamiento mediante IA se limita a la generación de un borrador de
              informe que siempre es revisado y aprobado por un profesional sanitario cualificado.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">10. Derechos del interesado</h2>
            <p>Conforme al RGPD, el paciente tiene derecho a:</p>
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
              Para ejercer estos derechos, el paciente puede dirigirse a FISIO ZARAGOZA, S.L.P. mediante
              email a{' '}
              <a href="mailto:rgpd@fisiozaragoza.com" className="text-blue-600 hover:text-blue-800">
                rgpd@fisiozaragoza.com
              </a>{' '}
              o en las oficinas situadas en c/ Almagro, nº 16, Local, 50004 Zaragoza, identificándose de
              forma fehaciente e indicando el derecho que ejercita. También tiene derecho a presentar una
              reclamación ante la Agencia Española de Protección de Datos (
              <a
                href="https://www.aepd.es"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                www.aepd.es
              </a>
              ).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">11. Seguridad de los datos</h2>
            <p>
              Se aplican medidas técnicas y organizativas apropiadas para garantizar la seguridad de los
              datos personales conforme al art. 32 del RGPD, incluyendo: cifrado en tránsito (HTTPS/TLS),
              control de acceso basado en roles, autenticación de usuarios, almacenamiento cifrado, y
              políticas de seguridad a nivel de fila (RLS) en la base de datos que garantizan que cada
              clínica solo puede acceder a los datos de sus propios pacientes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">12. Cookies</h2>
            <p>
              Esta plataforma utiliza exclusivamente cookies técnicas estrictamente necesarias para el
              funcionamiento de la autenticación y la sesión de usuario. No se utilizan cookies de seguimiento,
              analítica ni publicidad. Puede consultar más información en nuestra{' '}
              <Link href="/cookies" className="text-blue-600 hover:text-blue-800">
                Política de Cookies
              </Link>
              .
            </p>
          </section>

          <div className="border-t border-gray-200 pt-6 text-xs text-gray-400">
            <p>
              FISIO ZARAGOZA, S.L.P. — CIF B99562720 — c/ Almagro, nº 16, Local, 50004 Zaragoza.
              Esta política de privacidad se actualiza periódicamente para reflejar cambios en el tratamiento de datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
