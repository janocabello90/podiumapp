# Fase B — Deportes y pruebas (mini-plan de fase)

> Doc de la Fase B del `PLAN-IMPLEMENTACION-EQUIPOS.md`. Kickoff + registro de ejecución.
> **Objetivo:** catálogos de **deportes** y **pruebas** (con prompt de interpretación VALD por prueba) + relación **deporte→pruebas**, y asignación de deporte a **equipo** (default) y **paciente** (override). Configurable desde Ajustes.
> **Riesgo:** 🟢 bajo — 100% aditivo, **sin efecto en runtime** todavía (el deporte no dirige ninguna valoración hasta la Fase D). El flujo individual y la Fase A no cambian.
> **Criterio de "completada":** la clínica puede crear deportes, pruebas (con prompt) y mapear deporte→pruebas; se puede asignar deporte a un equipo y override a un paciente; `npm run build` verde; RLS aísla por clínica.

---

## Diseño de esquema (migración B1)

**`sports`**
- `id` uuid PK `default uuid_generate_v4()`
- `clinic_id` uuid NOT NULL → `clinics(id)` ON DELETE CASCADE
- `name` text NOT NULL · `description` text · `is_active` boolean `default true`
- `created_at`, `updated_at` timestamptz `default now()`
- UNIQUE `(clinic_id, name)`

**`tests`** (catálogo de pruebas)
- `id` uuid PK
- `clinic_id` uuid NOT NULL → `clinics(id)` ON DELETE CASCADE
- `name` text NOT NULL · `description` text
- `vald_interpretation_prompt` text  ← *el "prompt por prueba" del requisito*
- `result_schema` jsonb NULL  ← *reservado para resultados estructurados futuros (Fase D+)*
- `is_active` boolean `default true`
- `created_at`, `updated_at` timestamptz `default now()`
- UNIQUE `(clinic_id, name)`

**`sport_tests`** (relación N:M deporte→pruebas)
- `id` uuid PK
- `clinic_id` uuid NOT NULL → `clinics(id)` ON DELETE CASCADE
- `sport_id` uuid NOT NULL → `sports(id)` ON DELETE CASCADE
- `test_id` uuid NOT NULL → `tests(id)` ON DELETE CASCADE
- `display_order` int `default 0` · `is_required` boolean `default false`
- `created_at` timestamptz `default now()`
- UNIQUE `(sport_id, test_id)`

**Extensiones**
- `teams` → `+ sport_id` uuid NULLABLE → `sports(id)` ON DELETE SET NULL (deporte por defecto del equipo)
- `patients` → `+ sport_id` uuid NULLABLE → `sports(id)` ON DELETE SET NULL (override individual)

**Índices:** `idx_sports_clinic`, `idx_tests_clinic`, `idx_sport_tests_sport`, `idx_sport_tests_test`, `idx_teams_sport` (parcial), `idx_patients_sport` (parcial).
**Triggers:** `set_updated_at` en `sports` y `tests`.
**RLS (crítico):** ⚠️ `ensure_rls` deja las tablas nuevas deny-all → crear en la MISMA migración policies `FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (…)` en `sports`, `tests`, `sport_tests`. `teams`/`patients` no cambian sus policies (ya cubren el `sport_id`).

---

## Tareas (orden para ejecutar, una por prompt)

### B1 — Migración de esquema + tipos
- Una migración: `sports`, `tests`, `sport_tests`, `teams.sport_id`, `patients.sport_id` + índices + triggers + **policies RLS**, vía MCP `apply_migration`; archivo repo con el mismo nombre de versión.
- Regenerar `types/database.generated.ts`; añadir alias `Sport`, `Test`, `SportTest` en `database.ts` (`Team`/`Patient` heredan `sport_id`).
- `npm run build`. **Aceptación:** tablas + policies (verificar `pg_policies`), `teams.sport_id`/`patients.sport_id` existen, build OK.

### B2 — Catálogo de pruebas (`/settings/tests`)
- Página server `force-dynamic` (bajo `/settings`, ya protegida): lista de pruebas de la clínica + crear/editar prueba.
- Form client `components/settings/CreateTestForm.tsx` (o similar): `name`, `description`, `vald_interpretation_prompt` (textarea), `is_active`. Insert/update autenticado + `router.refresh()`.
- **Aceptación:** crear/editar/desactivar pruebas con su prompt.

### B3 — Catálogo de deportes + mapeo (`/settings/sports`, `/settings/sports/[id]`)
- `/settings/sports`: lista de deportes + crear deporte (patrón grupos: lista→detalle).
- `/settings/sports/[id]`: **editor de mapeo deporte→pruebas** — marcar qué pruebas del catálogo pertenecen al deporte (`sport_tests`), con `display_order` y `is_required` (add/remove filas).
- Forms client `CreateSportForm.tsx` + `SportTestsEditor.tsx`.
- **Aceptación:** crear deporte, asignarle pruebas con orden/required, quitar una prueba del mapeo.

### B4 — Integración en Ajustes
- En `SettingsClient`: nueva pestaña **"Deportes y pruebas"** con una landing que enlaza a `/settings/sports` y `/settings/tests` (mínimo, sin duplicar lógica).
- **Aceptación:** desde Ajustes se llega a ambos catálogos.

### B5 — Asignar deporte a equipo + override en paciente
- `/teams/[id]`: selector de **deporte del equipo** (`teams.sport_id`) — client component que lista `sports` y hace update.
- `/patients/[id]`: selector de **deporte (override)** del paciente (`patients.sport_id`), pequeño y discreto.
- **Aceptación:** asignar deporte a un equipo; override a un paciente; ambos persisten.

### B6 — Helper `resolveSport()` (sin consumidor aún)
- Función pura en `lib/clinical/` (o `lib/sports/`): `resolveSport({ sessionSportId, patientSportId, teamSportId })` → primer no-nulo (`session ?? patient ?? team`). Se **usará en Fase D**.
- **Aceptación:** función exportada y tipada; build OK.

### B7 — QA + docs + commit
- Checklist (abajo). Actualizar `CLAUDE.md` (§17: Fase B) + completar este doc. Commits **como Jano, sin push** hasta OK (código y docs por separado, como en A).

---

## Cambios de UX (resumen)
- Nueva pestaña **"Deportes y pruebas"** en Ajustes → catálogos.
- Páginas de config: `/settings/tests`, `/settings/sports`, `/settings/sports/[id]` (mapeo).
- Selector de **deporte** en la vista de equipo y override en la ficha de paciente.
- Sin cambios en sidebar (todo cuelga de Ajustes / equipo / ficha).

---

## Checklist de QA (tras la fase)
1. **Regresión (lo primero):** flujo individual y Fase A **sin cambios** (deporte no afecta a nada aún; solo config).
2. Crear deporte "fútbol"; crear pruebas (ej. CMJ, Nordbord, Sprint 10m) con su **prompt**; mapear fútbol→esas pruebas con orden y "requerida".
3. Editar/desactivar un deporte o prueba; quitar una prueba del mapeo.
4. Asignar deporte a un **equipo**; poner **override** en un paciente concreto; verificar que persisten.
5. **RLS / multi-tenant:** otra clínica no ve deportes/pruebas ajenos (o verificar `pg_policies`).
6. `npm run build` verde.

---

## Notas / riesgos
- **Sin efecto en runtime:** en Fase B el deporte y las pruebas **no dirigen** ninguna valoración todavía (eso llega en D con la sesión). Es catálogo + asignación → riesgo bajo, sin orden deploy-first.
- **`ensure_rls`:** las policies van en la misma migración; verificar `pg_policies` tras B1.
- **UNIQUE(clinic_id, name):** evita catálogos duplicados; los forms manejan el error de duplicado con un toast claro.
- **`result_schema`/`result_data`:** JSONB reservado; **no** se construye captura estructurada de resultados en B (decisión 6: notas por prueba desde D; estructurado más adelante).

---

## Cómo pasárselo a Sonnet
Una tarea por prompt, **B1 → B7**, con el ritual de siempre: *relee `CLAUDE.md` + `PLAN-IMPLEMENTACION-EQUIPOS.md` → identifica archivos → explica y por qué es seguro → implementa mínimo → cómo probar → resumen*. Reglas fijas: no ampliar alcance, no romper individual/Fase A, migración vía `apply_migration` + regenerar tipos, `npm run build` verde, commit como Jano sin push.

---

## Registro de ejecución
_(Se completa a medida que se ejecutan las tareas.)_

- **B1** — ✅ **HECHA (2026-07-25).** Migración `20260725230101_create_sports_tests_and_sport_link` aplicada vía MCP (archivo repo con el mismo nombre). Creadas `sports`, `tests` (con `vald_interpretation_prompt` + `result_schema` reservado), `sport_tests` (UNIQUE `sport_id,test_id`); `teams.sport_id` y `patients.sport_id` uuid NULLABLE (FK→sports ON DELETE SET NULL). Índices + triggers `updated_at` (sports/tests) + policies RLS `FOR ALL` clínica-scoped en las 3 (verificado `pg_policies` → no deny-all). Tipos regenerados (`database.generated.ts` + alias `Sport`/`Test`/`SportTest` en `database.ts`). `npm run build` OK. Sin commit / sin push.
- **B2** — ✅ **HECHA (2026-07-25).** `/settings/tests` (server) + `components/settings/TestsManager.tsx` (client): crear/editar/activar-desactivar/borrar pruebas, con `vald_interpretation_prompt` (textarea). Estado local + supabase; maneja duplicados (UNIQUE). `npm run build` OK.
- **B3** — ✅ **HECHA (2026-07-25).** `/settings/sports` (lista + `CreateSportForm`) y `/settings/sports/[id]` (detalle) + `components/settings/SportTestsEditor.tsx`: editor de mapeo deporte→pruebas (checkbox incluir → insert/delete `sport_tests`; `display_order` y `is_required` por prueba → update). `npm run build` OK. Nota: aún **sin acceso desde Ajustes** (eso es B4) → se navega por URL de momento.
- **B4** — ✅ **HECHA (2026-07-25).** `SettingsClient`: nueva pestaña **"Deportes y pruebas"** con dos cards que enlazan a `/settings/sports` y `/settings/tests`. `npm run build` OK.
- **B5** — ✅ **HECHA (2026-07-25).** Componente reutilizable `components/sports/SportSelect.tsx` (update de `sport_id` en `teams`/`patients`). Wiring: `/teams/[id]` (bar "Deporte del equipo") y `/patients/[id]` (card "Deporte" = override individual). Solo se muestran si hay deportes activos. `npm run build` OK.
- **B6** — ✅ **HECHA (2026-07-25).** Helper puro `lib/clinical/sport.ts` → `resolveSport({sessionSportId, patientSportId, teamSportId})` = `session ?? patient ?? team`. Sin consumidor aún (se usa en Fase D). Build OK.
- **B7** — ✅ **HECHA (2026-07-25).** `CLAUDE.md` §17 actualizado (Fase B). Doc de fase completado. Build verde. QA manual: ver checklist arriba (a ejecutar por el usuario). Commits: código B1–B6 y docs en commits separados (autor Jano, sin push).

**Fase B COMPLETADA.** Siguiente: Fase C (consentimientos y trazabilidad) — ver `PLAN-IMPLEMENTACION-EQUIPOS.md`.
