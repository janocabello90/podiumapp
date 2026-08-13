# Pendientes / Backlog — SHERPA

> Cosas acordadas para más adelante (no bloquean lo actual). Añadir aquí lo que se aparque.

## 📧 Envío de anamnesis por email (Resend) — CÓDIGO HECHO, falta config (2026-08)
**Estado**: implementado el botón **"Enviar por correo"** en la tarjeta de Anamnesis + endpoint `POST /api/anamnesis/send-email` (Resend vía REST). **Falta solo la configuración de entorno en Vercel**:
1. `RESEND_API_KEY` (cuenta de Resend).
2. **Dominio verificado** en Resend + `RESEND_FROM` (p. ej. `Clínica Podium <no-reply@dominio.com>`). Sin dominio verificado, Resend solo entrega a la propia cuenta (modo test con `onboarding@resend.dev`), no a pacientes.
El botón se deshabilita si el paciente no tiene email; da error claro si falta `RESEND_API_KEY`.

## 📧 (Histórico) Envío de anamnesis por email (Resend) — APARCADO (2026-07-31)
**Qué:** poder **enviar / reenviar la anamnesis por correo** al paciente (individual y en lote por equipo), además del WhatsApp/copiar enlace actual.

**Por qué está aparcado:** requiere infraestructura de email que aún no está configurada.

**Qué hace falta para retomarlo:**
1. **`RESEND_API_KEY`** en las variables de entorno de Vercel (se genera en la cuenta de Resend del cliente).
2. **Dominio verificado** en Resend para el remitente (p. ej. `no-reply@clinicapodium.com`). Alternativa temporal: dominio de pruebas de Resend (`onboarding@resend.dev`), que solo envía al email de la propia cuenta.

**Qué se implementará cuando esté lo anterior:**
- Endpoint `POST /api/anamnesis/send-email` (SDK de Resend + plantilla del email con el enlace del token).
- Botón **"Enviar por correo"** por paciente (en la ficha / tarjeta de anamnesis).
- Acción en lote **"Reenviar anamnesis a todo el equipo"** (a los jugadores con email) en la lista de Pacientes, junto a "Generar anamnesis que faltan".

**Ya preparado hoy (sin email):** en la lista de Pacientes, la acción por equipo **"Generar anamnesis que faltan"** crea los enlaces de los jugadores sin anamnesis; se distribuyen manualmente (WhatsApp/copiar) hasta que el email esté activo.

### Nota — remitente de los correos de AUTH (invitación/reset/confirmación)
Son dos cosas distintas:
- **Correos de Auth** (invitar usuario, reset, confirmar): los envía **Supabase (GoTrue)**. Con el correo por defecto el remitente es `noreply@mail.app.supabase.io` y **no se puede cambiar**. Para que ponga **SHERPA + dominio propio** hay que activar **Custom SMTP** en Supabase (Authentication → Emails → SMTP Settings). La vía fácil: **Resend SMTP** (sin código, solo pegar credenciales) → requiere **dominio verificado**. Plantilla branded ya lista en `email-templates/invitacion.html`.
- **Correos de la app** (enviar anamnesis al paciente): los enviaría nuestro backend con el **SDK de Resend** (`/api/anamnesis/send-email`) — el punto de arriba.

Ambos dependen de lo mismo: **cuenta Resend + dominio verificado**. Con eso se resuelven los dos de golpe.

---

## 🌐 Dominio propio + ocultar la app a los pacientes — PASOS (código ya hecho, 2026-08)
**Objetivo**: que las anamnesis lleguen desde un dominio de la clínica (no `podiumapp-two.vercel.app`) y que, si un paciente va a la raíz de ese dominio, NO descubra la app de gestión (login/dashboard). **El código ya está**: solo falta configurar dominios + variables en Vercel.

**Modelo: dos dominios para la misma app**
- **App (staff)**: por donde entráis vosotros (login/gestión). Puede ser la URL de Vercel actual o un subdominio propio (p. ej. `app.clinicapodium.com`).
- **Público (pacientes)**: p. ej. `anamnesis.clinicapodium.com` → SOLO sirve las anamnesis; el resto de rutas se bloquean.

**Pasos (se pueden hacer estos días):**
1. **Tener un dominio** de la clínica (si no, comprar uno; p. ej. en el registrador que uséis). Ej.: `clinicapodium.com`.
2. **Vercel → Project → Settings → Domains → Add**: añadir `anamnesis.clinicapodium.com` (y, si queréis, `app.clinicapodium.com`). Vercel mostrará un **registro DNS** (normalmente **CNAME** → `cname.vercel-dns.com`).
3. **En el DNS del dominio** (panel del registrador/gestor de DNS): crear el/los registros que indique Vercel:
   - `CNAME  anamnesis  →  cname.vercel-dns.com` (el valor exacto lo da Vercel).
   - (opcional) `CNAME  app  →  cname.vercel-dns.com`.
   - Esperar propagación (minutos–horas). Vercel valida y pone el HTTPS solo.
4. **Vercel → Settings → Environment Variables** (Production) — añadir:
   - `NEXT_PUBLIC_APP_URL = https://anamnesis.clinicapodium.com` (los enlaces a pacientes usarán este dominio).
   - `PUBLIC_ANAMNESIS_HOST = anamnesis.clinicapodium.com` (activa el "modo solo-anamnesis" en ese host).
   - `PUBLIC_REDIRECT_URL = https://www.clinicapodium.com` (opcional: a dónde mandar a quien husmee la raíz; si no se pone, sale un 404 neutro).
5. **Redeploy** (las variables `NEXT_PUBLIC_*` se aplican al hacer un nuevo deploy: un push cualquiera o "Redeploy" en Vercel).
6. **Staff**: acceder SIEMPRE por el dominio de la app (Vercel o `app.clinicapodium.com`), NO por `anamnesis.clinicapodium.com` (ese host bloquea el login a propósito).
7. **Probar**: abrir `https://anamnesis.clinicapodium.com/` → debe dar 404/redirección; abrir un enlace de anamnesis real → debe funcionar.

**Notas**
- Sin estas variables, todo sigue igual (un solo dominio). Es opcional y no rompe nada.
- El mismo dominio de la clínica sirve para el **remitente de correos (Resend)** — ver la sección de email; así se resuelven ambos con el mismo dominio verificado.
- Límite honesto: oculta la app a un paciente normal por completo; un técnico muy determinado podría fingerprintear Next.js/Vercel, pero no verá "podiumapp" ni el login/gestión.

---

## 📝 Consentimientos — pendiente de revisar (2026-08)
Contexto: se digitalizó el documento unificado de la clínica (imagen + protección de datos + consentimiento informado + ficha del deportista). Estado y pendientes:

- **Textos legales exactos**: ✅ **volcados del documento (2026-08)**. Los textos de **Protección de datos** (info RGPD del apartado A + responsable real Fisio Zaragoza SL / B99562729 / Calle Almagro 16 / rgpd@fisiozaragoza.com + consentimiento B.1), **Tratamiento de la información** (consentimiento informado págs 6–8 con riesgos, alternativas y declaración) y **Derechos de imagen** (B.2) están cargados en `consent_versions` con `version_label = 'borrador-doc'`. ⚠️ **PENDIENTE DE REVISIÓN JURÍDICA**: el PDF está marcado *"Borrador para revisión jurídica"*; la asesoría del cliente debe validar/ajustar el texto en **Ajustes → Consentimientos** antes de darlo por definitivo. **Uso de IA** se mantiene con el texto por defecto de la app (no figura en el documento).
- **Derechos de imagen**: ✅ implementado (tipo `image_rights` con canales, solo equipos). Texto base sembrado del documento — **revisar redacción legal**.
- **Menores / representante legal**: ✅ **implementado (v1, 2026-08)**. Detección **Opción C**: automática por fecha de nacimiento (<18) + casilla auto-declarada. Al marcar menor se piden datos del representante (nombre, DNI, relación) y los consentimientos se registran como **otorgados por el representante** (`consents.metadata.representative`), visible en la ficha. Pendiente/limitaciones: **sin firma manuscrita** (registro digital) y **sin verificación de identidad** del representante (declaración responsable, igual que en papel); "opinión/firma del menor con madurez suficiente" no se recaba (futuro si se quiere).
- **Firma manuscrita / electrónica**: **no implementada** a propósito. El registro digital es **check + fecha/hora + copia del texto versionado** (`consents` + `version_body`), suficiente como prueba de consentimiento RGPD. Si en el futuro se requiere firma real (trazo en pantalla o e-firma), es un desarrollo aparte.
- **Revocación del consentimiento**: **por correo** a la clínica (rgpd@fisiozaragoza.com) — decisión de negocio: **no** hay flujo en la app; los tres textos de consentimiento lo indican explícitamente. Si algún día se quisiera registrar la revocación dentro de la app (marcar un consentimiento como revocado con fecha), sería un añadido futuro.
- **DNI del jugador**: ✅ añadido a la anamnesis de equipo (campo opcional en "Datos personales").
- **Otros huecos del documento vs app** (menores): **nº de colegiado del fisioterapeuta** (no hay campo) y **historial de lesiones como tabla estructurada** (hoy texto libre) siguen pendientes si se quieren.

## 🔒 Privacidad — nombre del paciente hacia la IA (2026-08)
**Hecho**: al generar informes, el **texto** que se envía a la IA va **seudonimizado** — el nombre real se sustituye por un marcador (`[[PACIENTE]]` en individual/sesión; `[[JUGADOR_n]]` en estudio) y se **restituye** el nombre real en el informe recibido. Cubre datos, anamnesis, notas del fisio, exploración y notas por prueba. Código: `src/lib/reports/redact.ts` + `api/reports/generate` + `api/reports/campaign-generate`.

**⚠️ Límite conocido (pendiente de decisión jurídica)**: los **PDFs de VALD y las imágenes** que se adjuntan a la IA (lectura por *vision* para interpretar resultados) **suelen llevar el nombre del deportista impreso**. Por tanto el nombre **puede llegar a la IA a través del propio documento adjunto**, no por nuestro texto. No se puede tapar sin degradar la lectura del documento. Opciones:
- **Asumirlo** (recomendado): el texto va anonimizado; el nombre solo podría venir en el documento, que ya es del propio paciente. Es lo práctico y habitual.
- **Exportar el VALD sin nombre** desde la plataforma VALD (si permite anonimizar el sujeto) antes de subirlo.
- **No adjuntar el PDF** a la IA (se perdería la lectura automática de resultados).

Acordar con el cliente/asesoría qué nivel de anonimización exigen sobre los documentos adjuntos.

## 🤖 IA — modelo, calidad y coste (2026-08)
- **Migrar a Sonnet 5** (hoy `claude-sonnet-4-20250514`, en retirada jun-2026). Mejor visión (lee mejor las gráficas VALD) y razonamiento. Plan detallado en **`PLAN-SONNET5.md`**. Incluye: pensamiento adaptativo, `max_tokens` 8k→16k, streaming, subir el SDK y centralizar la config de IA. Coste ≈ el mismo (promo $2/$10 hasta 31-ago; luego ~+30% por tokenizador nuevo, sigue siendo céntimos).
- **Mostrar coste/tokens por informe en la UI (admin).** La app YA guarda por informe `ai_prompt_tokens` (entrada), `ai_completion_tokens` (salida) y `ai_model` en la tabla `reports`, pero **no se pinta en ninguna pantalla**. Añadir un indicador (p. ej. en la vista del informe, solo admin: *"X tokens entrada / Y salida ≈ Z €"*) + un acumulado mensual en Actividad/Ajustes. La app guarda tokens (dato duro); el € se calcula por el precio del modelo.
- **Caché de prompt para las guías de equipo (optimización de coste).** En balonmano se hacen las 22 pruebas → cada informe envía las 22 guías (~84k tokens, idénticas entre jugadores). Reordenando el prompt (guías fijas delante, datos del jugador detrás) + generando los informes seguidos, la caché baja el coste ~60% en los informes siguientes al primero (de ~$0,34 a ~$0,12 por jugador). Requiere reestructurar el prompt de `reports/generate`; ver `PLAN-SONNET5.md` (fase opcional).

## Otros pendientes conocidos (de docs previos)
- **Multi-equipo real** (una persona compartida en varios equipos, tabla N:M). Hoy: una ficha por (persona, equipo). Ver `FLUJO-EQUIPOS-CIERRE.md`.
- **Resultados de prueba estructurados** (`session_tests.result_data`) → habilitaría estadística numérica en el informe de estudio (hoy cualitativo).
- **Nº de seguimientos del estudio** (`planned_consultations`): hoy es solo informativo; darle sentido (consultas esperadas por jugador / recordatorios) es futuro.
- **Hardening P2/P3** (search_path en funciones, revoke execute; ver `CLAUDE.md` §11).
