# Refinamiento post-equipos (roles, UI y anamnesis editable) — 2026-07/08

> Cambios hechos **después** de cerrar el flujo de equipos (Fases A–H, ver `FLUJO-EQUIPOS-CIERRE.md`).
> Son transversales (permisos, UX y anamnesis), no una "fase" más del plan de equipos.
> El caso individual y el de equipo se conservan; todo aditivo/retrocompatible salvo donde se indica.

Convención: **[C]** confirmado en código de este repo.

---

## 1. Permisos por rol (admin vs fisio) — UI + backend + RLS **[C]**

Antes: el rol solo gateaba 5 acciones a nivel API; la UI era idéntica para todos. Ahora hay separación real.

- **Sidebar**: los fisios ven solo **Inicio, Estudios, Pacientes, Equipos, Ajustes**. **Informes** (`/reports`) y **Actividad** (`/activity`) son **admin-only** (ocultos + `redirect('/dashboard')` en servidor para no-admins).
- **Ajustes**: los fisios solo ven **Mi perfil**. El resto de pestañas y sub-páginas (`/settings/{tests,sports,consents,anamnesis}`) son admin-only (UI + redirect).
- **Helper SQL** `is_clinic_admin()` (`SECURITY DEFINER`, `search_path` fijado). RLS con **escritura solo admin** (lectura clínica) en: `tests`, `sports`, `sport_tests`, `consent_versions`, `groups`, `teams`, `campaigns`, `campaign_teams`, `anamnesis_templates`.
- **`users`**: SELECT = **uno mismo o admin** (un fisio no ve a otros usuarios). Invitar/eliminar/reset de usuarios y datos/logo de clínica (`/api/clinic`, `/api/clinic/logo`) = admin. Ajustes deja de traer el listado de personal a los fisios.
- **Crear estructura** (grupo, equipo, estudio, importación masiva de jugadores) = **solo admin** (RLS + botones ocultos). El fisio **sí** puede "Añadir jugador" suelto (escribe en `patients`) y **valorar** (sesiones/anamnesis). El deporte del equipo lo asigna solo el admin; el fisio lo ve como texto.
- **Borrar paciente**: botón solo visible para admin (la API ya lo bloqueaba).

Matiz: importación masiva vs "añadir jugador" ambas escriben en `patients`, así que la distinción es **solo de UI** (no separable por RLS).

## 2. Inicio (dashboard) por defecto "los míos" **[C]**

El panel abre en scope **Míos** por defecto (KPIs/alertas/etapas de tus pacientes). Toggle a "Toda la clínica" con `?scope=clinic`.

## 3. Renombrado "Campaña" → "Estudio" **[C]**

Cambio de **UI** y de **URL** (`/campaigns` → `/estudios`). La **tabla de BD sigue llamándose `campaigns`** (no se renombró; sería un rediseño innecesario). Crear estudios se puede desde `/estudios` (además de dentro del grupo).

## 4. Ficha del paciente individual como hub **[C]**

El paciente individual pasa a mostrar el **mismo hub** que un jugador de equipo: tarjeta **Anamnesis** + **Historial de consultas** (timeline con "Nueva consulta"). Se eliminó el bloque "Proceso del paciente" de 5 pasos. VALD/imágenes/informe viven **dentro de cada consulta** (página de sesión, Fase F).

## 5. Anamnesis: caducidad y estado real **[C]**

- Plazo del enlace **7 → 14 días** (default de `anamnesis_forms.expires_at`). Solo afecta a anamnesis nuevas.
- El estado **"Expirada" se deriva por fecha** (`isAnamnesisExpired()` en `src/lib/clinical/anamnesis.ts`): nada marca `status='expired'` en la BD, por eso antes las vistas internas no lo reflejaban. Ahora la ficha (chip rojo), el panel (alerta) y la etapa (`stage.ts`) lo calculan por fecha, con prioridad sobre pendiente/en progreso.
- Botón **"Renovar y reenviar"** en la tarjeta Anamnesis cuando ha caducado (genera un enlace nuevo, +14 días).

## 6. Contenido de la consulta: distinto por tipo de paciente **[C]**

El patrón se determina por si la consulta pertenece a un **estudio**: `isStudySession = !!session.campaign_id` (actualizado 2026-08; antes era por `patient.team_id`). Así, una **consulta individual de un jugador de equipo** (sin estudio) usa el **patrón individual** (exploración, ecografías, pruebas del catálogo), igual que un paciente sin equipo; solo las **consultas de estudio** usan el patrón de equipo. Al crear una consulta individual **no** se auto-generan las pruebas del deporte (el fisio las elige del catálogo). Secciones:

| Sección | Individual | Equipo |
|---|:---:|:---:|
| Contexto Estudio · Grupo · Equipo | — | ✅ |
| Deporte de la sesión | — | ✅ |
| Anamnesis y consentimientos | ✅ | ✅ |
| **Exploración** (multi-región) | ✅ | ❌ |
| Pruebas físicas | ✅ catálogo (checklist) | ✅ del deporte |
| Informes VALD | ✅ | ✅ |
| **Ecografías / fotografías** | ✅ | ❌ |
| **Anotaciones generales del fisio** | ✅ | ✅ |
| Informe IA | ✅ | ✅ |

- **Exploración multi-región** (solo individual): se pueden valorar **varias zonas** en la misma consulta (`clinical_data._regions`; pantalla resumen con progreso por región, añadir/quitar). Datos previos de una zona se infieren. `AssessmentForm`.
- **Pruebas (individual)**: sin deporte → checklist del **catálogo `tests`** de la clínica; marcar crea `session_tests` (con notas por prueba). `SessionTestPicker`. En equipo siguen dirigidas por el deporte (`SessionTestsPanel`).
- **Anotaciones generales** (ambos): texto libre en `sessions.notes`, incluido **siempre** en el contexto del informe IA (bloque propio, aunque no haya exploración). `SessionNotes`.

## 7. Anamnesis editable por plantillas (individual/equipo) **[C]**

- Tabla nueva **`anamnesis_templates`** (`clinic_id`, `audience` `'individual'|'team'`, `blocks` JSONB, único por clínica+audiencia). RLS lectura clínica / escritura admin. **Sin fila ⇒ plantilla por defecto del código** (`ANAMNESIS_BLOCKS` en `src/components/anamnesis/anamnesisFields.ts`) ⇒ retrocompatible.
- **Condiciones serializables**: se pasó de funciones JS a `{ field, in?, notIn? }` + helper `isFieldVisible()`. Render (`AnamnesisFormClient`) y visor (`AnamnesisViewer`) son ahora **data-driven** (reciben `blocks`).
- **Página pública** carga la plantilla **según el tipo de paciente** (equipo vs individual) vía service_role en `getByToken`. La ficha pasa la plantilla al visor de respuestas.
- **Editor**: Ajustes → pestaña **Anamnesis** (admin) → `/settings/anamnesis` (`AnamnesisTemplateEditor`): dos secciones **Individuales/Equipos**; crear/editar/reordenar/eliminar bloques y preguntas, todos los tipos + opciones, obligatorias, restablecer por defecto.
- **v1**: no se edita la **lógica condicional** (las de la individual se conservan y funcionan; se marcan como "condicional"). La de **equipo parte como copia de la individual**.

---

## Migraciones nuevas (en `supabase/migrations/`) **[C]**
- `20260731160019_restrict_config_and_users_to_admins`
- `20260731161750_restrict_org_structure_writes_to_admins`
- `20260801073948_anamnesis_expiry_14_days`
- `20260801090300_create_anamnesis_templates`

## Pendiente / decisiones v1
- Editor de anamnesis **con lógica condicional** (v2).
- Anamnesis de **equipo** con preguntas deportivas propias (hoy = copia de la individual hasta editarla).
- El patrón de consulta se deriva del paciente (no se congela por sesión): desvincular a un jugador de su equipo cambiaría el patrón de sus consultas existentes.
- Ver `PENDIENTES.md` (envío de anamnesis por email/Resend sigue aparcado).
