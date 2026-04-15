import Link from 'next/link'

export default function CookiesPage() {
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Política de Cookies</h1>
            <p className="text-xs text-gray-400">Última actualización: abril 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">1. ¿Qué son las cookies?</h2>
            <p>
              Una cookie es un pequeño fichero de texto que un sitio web envía al navegador y se almacena en
              el dispositivo del usuario (ordenador, teléfono móvil, tableta). Las cookies permiten al sitio
              web recordar información sobre la visita, como el idioma preferido o la sesión iniciada, para
              facilitar la próxima visita y hacer que el servicio resulte más útil.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">2. Cookies utilizadas en esta plataforma</h2>
            <p>
              Esta plataforma utiliza exclusivamente <strong>cookies técnicas estrictamente necesarias</strong> para
              su funcionamiento. Estas cookies están exentas del deber de obtener el consentimiento del usuario,
              conforme al art. 22.2 de la Ley 34/2002 (LSSI-CE) y a las directrices de la Agencia Española de
              Protección de Datos.
            </p>
            <p>
              <strong>No utilizamos:</strong> cookies analíticas, de publicidad, de seguimiento, de perfilado,
              ni cookies de terceros con fines comerciales.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">3. Detalle de cookies técnicas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="border border-gray-200 p-2 font-semibold text-gray-700">Nombre</th>
                    <th className="border border-gray-200 p-2 font-semibold text-gray-700">Titular</th>
                    <th className="border border-gray-200 p-2 font-semibold text-gray-700">Finalidad</th>
                    <th className="border border-gray-200 p-2 font-semibold text-gray-700">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 p-2 font-mono">sb-access-token</td>
                    <td className="border border-gray-200 p-2">Supabase (propia)</td>
                    <td className="border border-gray-200 p-2">Mantener la sesión del usuario autenticado</td>
                    <td className="border border-gray-200 p-2">Sesión</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-2 font-mono">sb-refresh-token</td>
                    <td className="border border-gray-200 p-2">Supabase (propia)</td>
                    <td className="border border-gray-200 p-2">Renovar automáticamente el token de sesión</td>
                    <td className="border border-gray-200 p-2">Sesión</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">4. Almacenamiento local</h2>
            <p>
              Además de las cookies técnicas, esta plataforma utiliza el almacenamiento local del navegador
              (localStorage) únicamente para guardar preferencias de configuración de la clínica (textos de
              pie de página, plantillas de informe). Estos datos se almacenan únicamente en el dispositivo
              del usuario y no se envían a servidores externos.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">5. Cómo gestionar las cookies</h2>
            <p>
              El usuario puede configurar su navegador para aceptar, rechazar o eliminar las cookies instaladas
              en su equipo. A continuación se indican los enlaces de los principales navegadores:
            </p>
            <p>
              <a
                href="https://support.google.com/chrome/answer/95647"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                Google Chrome
              </a>
              {' · '}
              <a
                href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                Mozilla Firefox
              </a>
              {' · '}
              <a
                href="https://support.apple.com/es-es/guide/safari/sfri11471/mac"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                Safari
              </a>
              {' · '}
              <a
                href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                Microsoft Edge
              </a>
            </p>
            <p>
              <strong>Advertencia:</strong> si el usuario rechaza las cookies técnicas, la plataforma no
              podrá funcionar correctamente, ya que son necesarias para mantener la sesión iniciada.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">6. Información adicional</h2>
            <p>
              Para más información sobre el tratamiento de sus datos personales, consulte nuestra{' '}
              <Link href="/privacidad" className="text-blue-600 hover:text-blue-800">
                Política de Privacidad
              </Link>
              . Para cualquier consulta sobre esta Política de Cookies, puede contactar con el Delegado de
              Protección de Datos en{' '}
              <a href="mailto:rgpd@fisiozaragoza.com" className="text-blue-600 hover:text-blue-800">
                rgpd@fisiozaragoza.com
              </a>
              .
            </p>
          </section>

          <div className="border-t border-gray-200 pt-6 text-xs text-gray-400">
            <p>
              FISIO ZARAGOZA, S.L.P. — CIF B99562720 — c/ Almagro, nº 16, Local, 50004 Zaragoza.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
