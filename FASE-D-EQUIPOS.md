# Fase D — Entidad Sesión + refactor de valoración (mini-plan de fase)

> Doc de la Fase D del `PLAN-IMPLEMENTACION-EQUIPOS.md`. **La fase de mayor riesgo.**
> **Objetivo:** convertir la valoración en una **sesión** de primera clase (navegable, con estado, deporte y **pruebas por prueba**), guiada por pasos, conservando el flujo individual. Migrar los `assessments` existentes a `sessions` **copiando, no moviendo**.
> **Riesgo:** 🔴 **ALTO** — repunta el flujo central. Salvaguardas obligatorias: **copiar-no-mover**, **feature-flag**, **paridad de UX**, **verificación de backfill**, **deploy-first en el repunte**.
> **Criterio de "completada":** con el flag ON, la valoración va por sesión (individual y jugador) con paridad de UX y pruebas derivadas del deporte; con el flag OFF, todo idéntico a hoy; `assessments` intacto; `npm run build` verde.

---

> **Nota (2026-07) — Campañas:** tras revisar requisitos se añade el concepto de **campaña** (estudio de valoración de un grupo/equipos que agrupa sesiones). **Fase D se mantiene enfocada al caso individual**: la sesión es campaña-agnóstica. `sessions.campaign_id` (nullable) y la capa de campañas se implementan en la **nueva Fase E** (ver adendas de `DISENO-EQUIPOS.md` y `PLAN-IMPLEMENTACION-EQUIPOS.md`). El stepper de sesión (D3) se reutilizará tal cual para campañas.

## Decisión arquitectónica clave: ABSORBER (no envolver)

`sessions` **absorbe** el rol de `assessments`: la exploración de 84 campos pasa a vivir en `sessions.clinical_data` (JSONB). `assessments` **se conserva intacto** como respaldo y origen del backfill (NO se borra en esta fase). El generador de informe pasa a leer `sessions.clinical_data` con **fallback** a `assessments` (legacy).

> Alternativa considerada: envolver (mantener `assessments`, `sessions.assessment_id`). Se descarta por dejar dos entidades solapadas; la absorción es la del diseño (`DISENO-EQUIPOS.md`). El riesgo de la copia se mitiga con "copiar-no-mover" + verificación.

---

## Diseño de esquema (migración D1)

**`sessions`** — valoración de primera clase
- `id` uuid PK `default uuid_generate_v4()`
- `clinic_id` uuid NOT NULL → `clinics(id)` ON DELETE CASCADE
- `patient_id` uuid NOT NULL → `patients(id)` ON DELETE CASCADE
- `physio_id` uuid NOT NULL → `users(id)`
- `sport_id` uuid NULLABLE → `sports(id)` ON DELETE SET NULL (deporte resuelto/override de la sesión)
- `session_number` int `default 1`
- `status` text CHECK `IN ('in_progress','completed')` `default 'in_progress'` (mantener simple, alineado con assessments)
- `clinical_data` jsonb `default '{}'` (los 84 campos de exploración)
- `notes` text
- `started_at`, `completed_at` timestamptz
- `created_at`, `updated_at` timestamptz `default now()` (+ trigger updated_at)
- Índice `(patient_id)`, `(clinic_id)`

**`session_tests`** — pruebas realizadas en la sesión + notas por prueba
- `id` uuid PK
- `clinic_id` uuid NOT NULL → `clinics(id)` ON DELETE CASCADE
- `session_id` uuid NOT NULL → `sessions(id)` ON DELETE CASCADE
- `test_id` uuid NULLABLE → `tests(id)` ON DELETE SET NULL (si se borra la prueba del catálogo, la fila sobrevive)
- `test_name` text NOT NULL (**snapshot** del nombre para conservar el registro clínico)
- `display_order` int `default 0` · `is_required` boolean `default false` (copiados del mapeo al crear)
- `status` text CHECK `IN ('pending','done','skipped')` `default 'pending'`
- `notes` text (interpretación del fisio **por prueba**)
- `result_data` jsonb NULL (reservado, Fase E+)
- `created_at`, `updated_at` timestamptz `default now()` (+ trigger)

**Extensiones**
- `reports` → `+ session_id` uuid NULLABLE → `sessions(id)` ON DELETE SET NULL
- `assessments` → **NO se toca** (respaldo).

**RLS (crítico):** ⚠️ `ensure_rls` = deny-all → policies en la misma migración. `sessions` y `session_tests`: `FOR ALL USING/WITH CHECK (clinic_id = get_user_clinic_id())`.

---

## Tareas

### D1 — Migración de esquema + tipos (aditivo, seguro)
- Migración `sessions` + `session_tests` + `reports.session_id` + índices + triggers + **policies RLS**, vía `apply_migration`. NO tocar `assessments`.
- Regenerar tipos + alias `Session`, `SessionTest` en `database.ts`.
- `npm run build`. **Aceptación:** tablas + policies (`pg_policies`), build OK. *Aplicable antes de desplegar (aditivo).*

### D2 — Backfill NO destructivo (`assessments` → `sessions`)
- Data migration (vía `apply_migration`): por cada `assessments` existente, **INSERT** una `session` con `patient_id`, `physio_id`, `session_number`, `status` (map directo), `clinical_data = assessment_data`, `notes`, timestamps.
- Repuntar `reports.session_id` desde `reports.assessment_id` (la sesión creada del mismo assessment).
- **`assessments` NO se borra ni se vacía.**
- **Verificación:** nº sessions creadas == nº assessments; spot-check 2-3 pacientes; `reports.session_id` poblado donde había `assessment_id`.
- *Snapshot/backup de la DB antes de este paso (aunque sea no destructivo).*

### D3 — Página de sesión (stepper) `/patients/[id]/sessions/[sessionId]`
Flujo guiado por pasos, **reutilizando** componentes existentes:
1. **Anamnesis + consentimientos** (solo lectura): reutiliza `AnamnesisViewer` + card de consentimientos.
2. **Exploración** (84 campos): reutiliza `AssessmentForm` + `VoiceDictation`, pero leyendo/escribiendo `sessions.clinical_data` (en vez de `assessments.assessment_data`).
3. **Pruebas según deporte**: `session_tests` derivadas del deporte (`resolveSport` → `sport_tests`), con **notas por prueba**. Si no hay deporte → lista vacía / añadir manual (no bloquea).
4. **Documentos VALD / imágenes**: reutiliza `DocumentSection`/`ImageGallerySection` (a nivel paciente en D; se ligan a la sesión en Fase E).
5. **Generar informe** (enlaza al flujo de informe).
- **Aceptación:** abrir una sesión, editar exploración, ver/rellenar pruebas del deporte con notas, todo persiste.

### D4 — Integración en la ficha + `stage.ts` + feature-flag
- **Flag `SESSIONS_ENABLED`** (env de servidor). OFF → ficha actual (lee `assessments`, ruta `/patients/[id]/assessment`). ON → ficha nueva (crea/abre `sessions`, ruta `/patients/[id]/sessions/[sessionId]`).
- "Iniciar/continuar valoración" en `/patients/[id]` crea/abre una **sesión** (bajo flag).
- Al crear sesión: derivar `session_tests` del deporte resuelto (`resolveSport` → `sport_tests`), copiando `test_name`/`display_order`/`is_required`.
- `stage.ts` → *session-aware* (deriva la etapa desde la última sesión cuando el flag está ON; desde assessments cuando OFF).
- **Aceptación:** flag OFF = idéntico a hoy; flag ON = valoración por sesión con paridad.

### D5 — Generador de informe lee la sesión
- `reports/generate`: leer `clinical_data` de la **última sesión** (fallback a `assessments` legacy si no hay sesión). Set `reports.session_id`.
- (El contexto por-prueba + VALD ligado a sesión es **Fase E**; en D basta con no perder la exploración.)
- **Aceptación:** generar informe desde una sesión incluye la exploración; informes antiguos siguen abriéndose.

### D6 — QA + docs + commit
- Checklist (abajo). `CLAUDE.md` §17 (Fase D) + cerrar este doc. Commits Jano (código + docs). **Ojo al orden de despliegue** (ver salvaguardas).

---

## Riesgos y salvaguardas (leer antes de tocar)

| Riesgo | Salvaguarda |
|---|---|
| Perder la exploración de valoraciones existentes | **Backfill copia, no mueve**; `assessments` intacto; verificación de conteos + spot-check |
| Romper el flujo individual actual | **Feature-flag**: OFF = flujo viejo idéntico; se activa solo con paridad probada |
| Repunte UI↔datos roto en prod | **Deploy-first**: desplegar el código nuevo (flag OFF) → activar el flag después; la migración D1/D2 es aditiva y se aplica antes |
| Sesión sin deporte (paciente suelto) | El stepper tolera "sin pruebas"; no bloquea; exploración + informe siguen |
| Borrar una prueba del catálogo con notas asociadas | `session_tests.test_id` SET NULL + `test_name` snapshot → el registro sobrevive |
| Backfill irreversible | Es aditivo (crea sessions; no borra nada). Rollback = flag OFF + (si hace falta) borrar las sessions creadas. Snapshot previo por si acaso |

**Reversibilidad:** ninguna migración destructiva. Rollback = flag OFF (UI vuelve a assessments). Las `sessions` creadas quedan huérfanas pero inertes con el flag OFF.

---

## Checklist de QA
1. **Regresión (flag OFF, lo primero):** flujo individual y Fases A/B/C **idénticos** (assessments, informe, PDF).
2. **Flag ON — paciente suelto sin deporte:** crear sesión, exploración, sin pruebas, informe → funciona.
3. **Flag ON — jugador con deporte de equipo:** la sesión muestra las **pruebas del deporte**; notas por prueba; exploración; informe.
4. **Backfill:** un paciente con valoración previa muestra su sesión con los mismos datos; su informe antiguo se sigue abriendo.
5. **Resolución de deporte:** `session ?? patient ?? team` correcta (asignar deporte a equipo y override a paciente).
6. `npm run build` verde.

---

## Cómo ejecutar (con Sonnet/Opus)
D1 y D2 son delicadas de diseño → **Opus** (esquema + backfill + verificación). D3–D5 son implementación → **Sonnet**, tarea a tarea. Ritual de siempre. Migraciones vía `apply_migration` + regenerar tipos. **No** activar el flag hasta paridad + deploy.

> Nota (contexto actual): **cero usuarios reales** en prod → el flag sigue siendo la red de seguridad recomendada, pero si se quiere ir más rápido se puede desplegar con el flag ON directamente y validar en el acto (asumible por la ausencia de usuarios). Decisión al llegar a D4.

---

## Registro de ejecución
_(Se completa a medida que se ejecutan las tareas.)_

- **D1** — ✅ **HECHA (2026-07-27).** Migración `20260727183513_create_sessions_and_session_tests` (archivo repo). `sessions` (clinical_data JSONB, sport_id, status, session_number, timestamps) + `session_tests` (test_id SET NULL + `test_name` snapshot, display_order, is_required, status, notes, result_data) + `reports.session_id` NULLABLE. Índices + triggers + RLS `FOR ALL` clínica-scoped (verificado `pg_policies`). `assessments` intacto. Tipos regenerados + alias `Session`/`SessionTest` en `database.ts`. `npm run build` OK. Sin commit / sin push.
- **D2** — ✅ **HECHA (2026-07-28).** Backfill `assessments`→`sessions` (copiar-no-mover) + `sessions.source_assessment_id`. Migración `20260728070429`. Verificado 2 assessments → 2 sessions; `assessments` intacto; reports repuntados (0 en prod). Tipos actualizados.
- **D3** — ✅ **HECHA (2026-07-28).** Página `/patients/[id]/sessions/[sessionId]` (stepper: contexto anamnesis/consentimientos + exploración `AssessmentForm` sobre `clinical_data` + `SessionTestsPanel` con notas por prueba/carga del deporte + link a ficha). `AssessmentForm` parametrizado (`table`/`dataColumn`). `POST /api/sessions` crea sesión + genera `session_tests` del deporte resuelto.
- **D4** — ✅ **HECHA (2026-07-28).** Ficha paso 2 → sesiones (`StartSessionButton`, "Continuar/Ver", "Nueva valoración", multi-sesión). `stage.ts` session-aware (fallback assessments); dashboard/lista/roster traen `sessions`. **Sin feature-flag** (ir directo; 0 usuarios reales).
- **D5** — ✅ **HECHA (2026-07-28).** `reports/generate` lee `sessions.clinical_data` (fallback assessment) + guarda `reports.session_id`.
- **D6** — ✅ **HECHA (2026-07-28).** `CLAUDE.md` §17 (Fase D). Doc cerrado. `npm run build` OK (33 páginas). Commits Jano (código + docs).

**Fase D COMPLETADA.** Legacy (`assessments`, `/patients/[id]/assessment`) conservado como respaldo. Siguiente: **Fase E — Campañas**.
