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

---

## Otros pendientes conocidos (de docs previos)
- **Multi-equipo real** (una persona compartida en varios equipos, tabla N:M). Hoy: una ficha por (persona, equipo). Ver `FLUJO-EQUIPOS-CIERRE.md`.
- **Resultados de prueba estructurados** (`session_tests.result_data`) → habilitaría estadística numérica en el informe de estudio (hoy cualitativo).
- **Nº de seguimientos del estudio** (`planned_consultations`): hoy es solo informativo; darle sentido (consultas esperadas por jugador / recordatorios) es futuro.
- **Hardening P2/P3** (search_path en funciones, revoke execute; ver `CLAUDE.md` §11).
