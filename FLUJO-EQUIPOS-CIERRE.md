# Flujo de Equipos (SHERPA / podium-app) — Documento de cierre A–H

> Resumen único del trabajo de equipos/campañas. Complementa los docs por fase (`FASE-A…H-EQUIPOS.md`), el diseño (`DISENO-EQUIPOS.md`), el plan (`PLAN-IMPLEMENTACION-EQUIPOS.md`) y §17 de `CLAUDE.md`.
> **Estado:** Fases **A–H COMPLETADAS y desplegadas** (push a `main` = producción Vercel). Cada fase fue aditiva; **el caso individual permanece intacto** (todas las FKs organizativas son NULLABLE).
> **Fecha de cierre:** 2026-07-29.

---

## 1. Qué se ha construido (de un vistazo)

Se ha pasado de una app de **paciente individual** a soportar además **valoración deportiva por grupos/equipos/campañas**, sin romper el flujo individual:

Grupo → Equipos → Jugadores (=pacientes con `team_id`) → **Sesiones** de valoración (guiadas por deporte) → **Campañas** que agrupan sesiones de un estudio → **Informe individual** por sesión + **Informe agregado** por campaña. Configuración de **deportes/pruebas** y **consentimientos** versionados. **Alta masiva** de jugadores por CSV/Excel.

---

## 2. Fases

| Fase | Entregable | Migración principal |
|---|---|---|
| **A** | Organización: `groups`, `teams`, `patients.team_id`; rutas `/groups`, `/groups/[id]`, `/teams/[id]`; sidebar "Equipos"; Ajustes "Equipo"→"Personal" | `20260725152017_create_groups_teams_and_patient_team_link` |
| **B** | Deportes y pruebas: `sports`, `tests`, `sport_tests`; `teams.sport_id`/`patients.sport_id`; Ajustes "Deportes y pruebas"; `resolveSport()` | `20260725230101_create_sports_tests_and_sport_link` |
| **C** | Consentimientos versionados: `consent_versions`, `consents`; 3 consentimientos en anamnesis pública; trazabilidad en la ficha | `20260727154457_create_consents_and_consent_versions` |
| **D** | Entidad **Sesión**: `sessions` (+`clinical_data`), `session_tests` (+notas por prueba), `reports.session_id`; página de sesión (stepper); backfill assessments→sessions (copiar-no-mover) | `20260727183513` (+ backfill `20260728070429`) |
| **E** | **Campañas**: `campaigns`, `campaign_teams`, `sessions.campaign_id`; `/campaigns/[id]`; valorar en campaña; cerrar campaña | `20260728074407_create_campaigns_and_campaign_teams` |
| **F** | VALD/imágenes por sesión (`documents.session_id`/`session_test_id`) + informe individual sobre la sesión (contexto IA con pruebas + prompts VALD) | `20260729083709_link_documents_to_sessions` |
| **G** | Informe agregado de **campaña** (IA cualitativo): `reports.scope`/`campaign_id`, `patient_id` NULLABLE; generador, revisión y PDF de campaña | `20260729085432_add_campaign_scope_to_reports` |
| **H** | Alta masiva **CSV/Excel** de jugadores (sin migración; dependencia `xlsx` code-split) | — |

---

## 3. Modelo de datos (entidades nuevas y enlaces)

**Tablas nuevas:** `groups`, `teams`, `sports`, `tests`, `sport_tests`, `consent_versions`, `consents`, `sessions`, `session_tests`, `campaigns`, `campaign_teams`.

**Columnas añadidas a tablas existentes:**
- `patients`: `team_id` (→teams, SET NULL), `sport_id` (→sports, SET NULL), `vald_interpretation` (Fase 0).
- `teams`: `sport_id` (→sports, SET NULL).
- `sessions`: `sport_id`, `campaign_id` (→campaigns, SET NULL), `source_assessment_id`.
- `documents`: `session_id`, `session_test_id` (ambos → SET NULL).
- `reports`: `session_id`, `scope ('individual'|'campaign')`, `campaign_id` (→campaigns, SET NULL); `patient_id` relajado a **NULLABLE** + CHECK de coherencia.

**Jerarquía / resolución:**
- `Grupo → Equipos → Jugadores`. Un jugador (=paciente) pertenece **a lo sumo a un equipo** (`team_id` único). *No hay* multi-equipo real (una persona en dos equipos = dos fichas). Ver §6.
- Deporte de una sesión: `resolveSport()` = `sesión ?? paciente ?? equipo`.
- Una **campaña** es de un grupo e incluye un **subconjunto** de sus equipos (`campaign_teams`). Una **sesión** con `campaign_id` pertenece al estudio; `null` = individual.

**RLS:** todas las tablas nuevas con RLS `FOR ALL` **clínica-scoped** (recordar el event trigger `ensure_rls` = deny-all por defecto; las policies se añadieron en cada migración). La escritura pública (anamnesis) sigue por **service_role**, sin policies públicas.

---

## 4. Superficie de UI y API

**Rutas de página nuevas:** `/groups`, `/groups/[id]`, `/teams/[id]`, `/patients/[id]/sessions/[sessionId]`, `/campaigns/[id]`, `/campaigns/[id]/report`, `/settings/sports`, `/settings/sports/[id]`, `/settings/tests`, `/settings/consents`. (`/groups`, `/teams`, `/campaigns`, `/settings` en `isProtectedRoute`.)

**Endpoints API nuevos/modificados:**
- `POST /api/sessions` — crea sesión (resuelve deporte, genera `session_tests`; acepta `campaignId`).
- `POST /api/reports/generate` — informe individual; acepta `sessionId` (usa esa sesión + pruebas + docs de la sesión).
- `POST /api/reports/campaign-generate` — **nuevo**: informe agregado de campaña.
- `POST /api/reports/export-pdf-campaign` — **nuevo**: PDF del informe de campaña (separado del individual).
- `PATCH /api/reports/[id]` — genérico (sirve individual y campaña).
- `POST /api/documents` — acepta `session_id`/`session_test_id`.
- `PATCH /api/anamnesis/[token]` — registra 3 consentimientos (service_role).

---

## 5. Checklist de QA end-to-end (en el deploy)

**Individual (regresión — debe seguir igual):**
- [ ] Crear paciente suelto (sin equipo) → anamnesis (enlace) → sesión (exploración) → VALD/imágenes → generar informe → revisar/aprobar → PDF.

**Organización (A/B):**
- [ ] Crear grupo → equipo → asignar deporte al equipo. En Ajustes: crear pruebas y mapear deporte→pruebas (con botón "Guardar cambios").

**Consentimientos (C):**
- [ ] Anamnesis pública muestra 3 consentimientos; al enviar quedan registrados en la ficha del paciente.

**Sesión (D):**
- [ ] En un jugador, iniciar sesión → las pruebas del deporte aparecen en el paso 3; notas por prueba se guardan. Multi-sesión (seguimiento) funciona.

**Campañas (E):**
- [ ] Crear campaña sobre un grupo (elegir equipos, fechas, nº seguimientos). Detalle: roster por equipo + progreso valorados/total. "Valorar" crea sesión con `campaign_id`. Cerrar campaña.

**VALD + informe individual por sesión (F):**
- [ ] Subir PDF VALD e imagen **desde la sesión** (quedan en esa sesión). Generar informe desde la sesión → recoge notas + guía VALD por prueba. Paciente sin VALD → informe igualmente.

**Informe de campaña (G):**
- [ ] Con ≥1 jugador valorado, "Generar informe de campaña" → revisión editable → aprobar → PDF. Sin nadie valorado → botón deshabilitado.

**Alta masiva (H):**
- [ ] Importar CSV y XLSX (plantilla incluida); fila sin nombre → error; email repetido en el equipo → duplicada excluida; fechas en dos formatos; roster se actualiza.

**Transversal:**
- [ ] RLS: otra clínica no ve grupos/equipos/campañas/informes ajenos. `npm run build` verde.
- [ ] `ANTHROPIC_API_KEY` presente en Vercel (necesaria para generar informes individuales **y** de campaña).

---

## 6. Límites conocidos / futuro (no incluido en A–H)

- **Multi-equipo real:** una persona compartida entre equipos como un **único** registro → requiere tabla N:M `patient_teams` y tocar roster/filtros/campañas. Hoy: una ficha por (persona, equipo).
- **Resultados de prueba estructurados:** hoy VALD/pruebas son **texto** (notas + interpretación + PDF); no hay parsing numérico. Por eso el informe de campaña es **cualitativo**. Futuro: `session_tests.result_data` (JSONB, ya reservado) para métricas agregadas reales (asimetrías, percentiles, desglose por edad/posición).
- **`position` de jugador:** no existe en `patients` → el desglose del informe de campaña es solo por equipo (edad/posición = futuro).
- **Integración API de VALD:** sigue siendo futura (hoy solo subida de PDFs + texto).
- **Envío de anamnesis:** manual (WhatsApp/copiar enlace); sin backend de envío. Enlace delegado de alta (token+service_role) = pospuesto de diseño.
- **PDF de campaña:** maquetación mínima v1 (sin diseño de marca específico para el colectivo).
- **Consolidación UI:** los documentos aparecen tanto en la ficha (nivel paciente) como en la sesión; unificar es cosmético pendiente.
- **Deuda previa (no de equipos):** fire-and-forget de clasificación con reenvío de cookie; parseo JSON del LLM con regex; modelos IA hardcodeados. Ver `CLAUDE.md` §11.

---

## 7. Referencias
- Diseño: `DISENO-EQUIPOS.md` · Plan: `PLAN-IMPLEMENTACION-EQUIPOS.md`
- Por fase: `FASE-A-EQUIPOS.md` … `FASE-H-EQUIPOS.md`
- Saneamiento previo: `FASE-0-SANEAMIENTO.md`
- Memoria técnica viva: `CLAUDE.md` (§17 = progreso de equipos)
