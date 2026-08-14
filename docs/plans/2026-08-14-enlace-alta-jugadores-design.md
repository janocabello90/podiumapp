# Enlace público de alta de jugadores por equipo — Diseño

**Fecha:** 2026-08-14
**Estado:** diseño aprobado (pendiente de implementación)
**Ámbito:** flujo de equipos. Aditivo; no toca el alta individual ni la importación CSV existentes.

---

## 1. Resumen

Cada equipo puede generar un **enlace público con token** (estilo anamnesis) que abre un formulario
donde una persona **externa, sin cuenta** (un delegado/entrenador de confianza del club) **da de alta
jugadores en ese equipo** — manualmente uno a uno **o** subiendo un CSV/XLSX. El enlace se puede
**regenerar** (invalida el anterior) y **bloquear/activar** a voluntad. Objetivo: quitar el "coñazo"
de meter muchos jugadores en varios equipos a mano desde dentro de la app.

## 2. Objetivos y no-objetivos

**Objetivos**
- Enlace público por equipo, con token, para alta de jugadores autoservicio por un externo.
- Alta **manual multi-fila** y por **CSV/XLSX** en el mismo formulario.
- Controles en la app: **generar / copiar / compartir / regenerar / bloquear**.

**No-objetivos (YAGNI)**
- **Caducidad automática** del enlace (el control es manual: bloquear/regenerar).
- **Cola de revisión / moderación** por jugador (los altas van directas al roster; el on/off del enlace es la puerta de control).
- **CAPTCHA / rate-limiting** en v1.
- **Histórico de enlaces** (un solo enlace activo por equipo; regenerar sobrescribe).
- **Enlace por grupo** (es por equipo).
- **Notificación** al fisio cuando alguien añade jugadores.

## 3. Decisiones (log)

| # | Decisión | Elegido |
|---|----------|---------|
| 1 | Persona / multiplicidad | Un **delegado externo** añade **varios** jugadores (manual + CSV/XLSX) |
| 2 | Moderación | **Directo al roster** (sin cola de revisión) |
| 3 | Quién gestiona el enlace en la app | **Fisios y admins** |
| 4 | Modelo del token | **Un enlace activo por equipo** (columnas en `teams`) |
| 5 | Caducidad | **Ninguna** (control manual) |
| 6 | Privacidad del formulario | **Write-only** (no muestra el roster existente) |

## 4. Modelo de datos

Columnas nuevas en `teams` (aditivo). Vía MCP `apply_migration` + regenerar tipos.
- `invite_token uuid` — token del enlace (nullable, único). `NULL` = sin enlace generado.
- `invite_active boolean DEFAULT true` — activo / bloqueado.

Los jugadores se crean en `patients` con `team_id` + `clinic_id` del equipo del token (igual que el
alta normal). No hay tabla nueva ni estado extra.

RLS: `teams` ya es clínica-scoped; las columnas nuevas heredan RLS. La escritura pública (insertar
`patients`) va por **service_role** desde el endpoint público, sin policy pública nueva.

## 5. Flujo público

### 5.1 Ruta y carga
- Ruta pública `/alta/[token]` (añadida a las rutas públicas del middleware, como `/anamnesis`).
- Carga (server, service_role): busca el equipo por `invite_token`.
  - Token inexistente o `invite_active = false` → **página de error amable** ("Este enlace no es válido o ha sido desactivado").
  - Válido → muestra **solo el nombre del equipo** + el formulario. **No** lista el roster (write-only, cero fuga de PII).

### 5.2 Formulario (cliente, sin sesión)
- **Manual**: filas repetibles — `nombre*` (obligatorio) + email · teléfono · fecha nacimiento · sexo · notas. Botón "Añadir otro".
- **CSV/XLSX**: subir fichero → parseo con `lib/patients/rosterImport` (existente) → **previsualización** con estado por fila (válida / error + motivo) → confirmar. Plantilla descargable (`buildTemplateCsv`).

### 5.3 Endpoint de envío
`POST /api/team-invite/[token]` (service_role):
1. Revalida token + `invite_active` (pudo bloquearse durante el rellenado).
2. Valida cada jugador en servidor (reglas de `validateRow`: `nombre` obligatorio; email/fecha/sexo).
3. **Duplicados**: omite los que ya existan **por email dentro de ese equipo** y los duplicados dentro del propio envío. Los sin email se insertan.
4. Aplica el **tope por envío** (máx. 100). Inserta los válidos en `patients` (`team_id`, `clinic_id`).
5. Devuelve conteos: `{ añadidos, omitidos_duplicados, con_error: [{fila, motivo}] }` — **sin nombres** de los duplicados.

### 5.4 Confirmación
Al delegado: *"N añadidos · M ya existían · K con error (fila X: motivo)"*.

## 6. Gestión en la app

En `/teams/[id]`, tarjeta **"Enlace de alta de jugadores"** (fisios y admins):
- Sin enlace → **Generar enlace**.
- Activo → URL + **Copiar** · **Compartir por WhatsApp** · **Regenerar** (confirmación) · **Bloquear**.
- Bloqueado → chip "Bloqueado" + **Activar** · **Regenerar**.

Endpoint autenticado `POST /api/teams/[id]/invite` con `action: generate | regenerate | block | activate`,
scope de clínica (RLS). `generate`/`regenerate` fijan `invite_token = uuid nuevo` + `invite_active = true`;
`block`/`activate` cambian `invite_active`.

## 7. Seguridad y casos límite

- **Autorización pública** = posesión del token **+** `invite_active`. Escritura por service_role tras validar (molde anamnesis).
- **Token** = uuid v4 (no adivinable). Regenerar invalida el anterior; bloquear lo desactiva sin borrarlo. Rechazo en página **y** endpoint.
- **Tope por envío** (máx. 100 jugadores) para acotar abuso.
- **Sin CAPTCHA/rate-limit** en v1 (enlace privado + on/off como control). Ampliable después.
- **Duplicados** por email dentro del equipo (omitir + avisar sin revelar nombres).
- **Middleware**: `/alta` a rutas públicas. Requiere `SUPABASE_SERVICE_ROLE_KEY` (ya presente para anamnesis).
- **Errores**: token inválido/bloqueado → mensaje claro; fichero mal formado → la previsualización marca filas; envío parcial → inserta los válidos e informa de los fallidos.

## 8. Reutilización y migración

- **Reutiliza:** patrón token + service_role de anamnesis; `rosterImport` (parseo/validación CSV/XLSX, alias, fecha, sexo); patrón de compartir (copiar/WhatsApp) de `AnamnesisActions`.
- **Migración:** solo columnas nuevas en `teams` (aditivo, sin migración de datos). El resto del alta (individual, CSV interno) queda intacto.

## 9. Fases de implementación (alto nivel)

- **F1** — Migración: `teams.invite_token` + `teams.invite_active`; regenerar tipos.
- **F2** — Gestión en la app: endpoint `POST /api/teams/[id]/invite` + tarjeta en `/teams/[id]` (generar/copiar/compartir/regenerar/bloquear).
- **F3** — Flujo público: ruta `/alta/[token]` (página + validación server) + formulario (manual + CSV/XLSX con `rosterImport`) + endpoint `POST /api/team-invite/[token]` (service_role, validación, duplicados, tope, insert) + `/alta` en el middleware.
- **F4** — Repaso de casos límite (bloqueo en caliente, duplicados, envío parcial) y textos.
