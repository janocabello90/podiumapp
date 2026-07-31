# Pendientes / Backlog — SHERPA

> Cosas acordadas para más adelante (no bloquean lo actual). Añadir aquí lo que se aparque.

## 📧 Envío de anamnesis por email (Resend) — APARCADO (2026-07-31)
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

## Otros pendientes conocidos (de docs previos)
- **Multi-equipo real** (una persona compartida en varios equipos, tabla N:M). Hoy: una ficha por (persona, equipo). Ver `FLUJO-EQUIPOS-CIERRE.md`.
- **Resultados de prueba estructurados** (`session_tests.result_data`) → habilitaría estadística numérica en el informe de estudio (hoy cualitativo).
- **Nº de seguimientos del estudio** (`planned_consultations`): hoy es solo informativo; darle sentido (consultas esperadas por jugador / recordatorios) es futuro.
- **Hardening P2/P3** (search_path en funciones, revoke execute; ver `CLAUDE.md` §11).
