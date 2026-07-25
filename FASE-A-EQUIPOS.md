# Fase A — Organización + roster (mini-plan de fase)

> Doc de la Fase A del `PLAN-IMPLEMENTACION-EQUIPOS.md`. Kickoff + registro de ejecución.
> **Objetivo:** capa organizativa (grupos → equipos → jugadores) con alta manual y roster, **sin tocar el flujo individual** (`patients.team_id` NULLABLE).
> **Riesgo global:** 🟢 bajo (todo aditivo, sin acoplamiento UI↔datos → las migraciones se pueden aplicar antes de desplegar).
> **Criterio de "completada":** se crean grupos/equipos, se añade jugador manual, se ve el roster; el paciente sin equipo funciona igual que hoy; RLS aísla por clínica; `npm run build` verde.

---

## Diseño de esquema (migración A1)

**`groups`**
- `id` uuid PK `default uuid_generate_v4()`
- `clinic_id` uuid **NOT NULL** → `clinics(id)` ON DELETE CASCADE
- `name` text NOT NULL · `notes` text NULL
- `created_at`, `updated_at` timestamptz `default now()`

**`teams`**
- `id` uuid PK
- `clinic_id` uuid NOT NULL → `clinics(id)` ON DELETE CASCADE
- `group_id` uuid NOT NULL → `groups(id)` ON DELETE CASCADE
- `name` text NOT NULL · `category` text NULL (ej. benjamines) · `notes` text NULL
- `created_at`, `updated_at` timestamptz `default now()`
- **`sport_id` NO va aquí** — se añade en Fase B.

**`patients` (extensión)**
- `+ team_id` uuid **NULLABLE** → `teams(id)` **ON DELETE SET NULL** (si se borra el equipo, el jugador queda suelto, no se borra).

**Índices:** `idx_groups_clinic(clinic_id)`, `idx_teams_clinic(clinic_id)`, `idx_teams_group(group_id)`, `idx_patients_team(team_id) WHERE team_id IS NOT NULL`.

**Triggers:** `set_updated_at` BEFORE UPDATE en `groups` y `teams` (reutiliza `update_updated_at()`).

**RLS (crítico):** ⚠️ El event trigger `ensure_rls` deja las tablas nuevas **RLS-ON sin policies = deny-all**. La migración **debe** incluir:
- `groups`: `FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id())`.
- `teams`: idéntico patrón.
- `patients`: **sin cambios** — `Users can update clinic patients` ya cubre asignar/quitar `team_id`.

---

## Tareas (orden para ejecutar, una por prompt)

### A1 — Migración de esquema + tipos
- Crear **una** migración (grupos + equipos + `patients.team_id` + índices + triggers + **policies RLS**) vía MCP `apply_migration`; crear el archivo del repo con el **mismo nombre de versión** que asigne el historial.
- Regenerar `types/database.generated.ts`; en `types/database.ts` añadir alias `Group`, `Team` (derivados del Row) — `Patient` hereda `team_id` solo.
- `npm run build`. *Aditivo → seguro aplicar antes de desplegar.*
- **Aceptación:** tablas creadas con RLS + policies (verificar `pg_policies`), `patients.team_id` existe, tipos regenerados, build OK.

### A2 — Páginas de grupos
- `/(dashboard)/groups/page.tsx`: lista de grupos (nombre, nº equipos) + alta de grupo.
- `/(dashboard)/groups/[id]/page.tsx`: detalle → equipos del grupo + alta de equipo (nombre, categoría).
- Server components `force-dynamic`, queries **filtrando `clinic_id`** además de RLS. Helper de creación con `clinic_id` del perfil.

### A3 — Roster de equipo + alta manual
- `/(dashboard)/teams/[id]/page.tsx`: cabecera del equipo + **roster** (pacientes con `team_id`=este equipo: nombre, etapa `computeStage`, link a ficha) + botón "Añadir jugador".
- Alta: **reutilizar** `patients/new` aceptando `team_id` opcional (query param/campo oculto). Datos mínimos: nombre, teléfono, email.

### A4 — Ficha de paciente + lista con equipo
- `/patients/[id]`: si `team_id` no es NULL, bloque **"Equipo"** (nombre + link a `/teams/[id]`); si NULL, ficha idéntica a hoy.
- `/patients` (lista): filtro **por equipo** y **"sin equipo"** (extiende `PatientFilters`).

### A5 — UX: renombre staff + entrada "Equipos"
- Ajustes: **"Equipo" (staff) → "Personal"** (`SettingsClient`: label del tab `team` → "Personal"; **no** cambiar el `id` interno).
- `Sidebar`: entrada **"Equipos"** → `/groups` (desktop + revisar bottom-nav móvil de 4 slots). Icono distinto del de Pacientes.
- *(Después de A2 para que la entrada no apunte a página inexistente.)*

### A6 — QA de regresión + docs + commit
- Checklist de pruebas (abajo).
- Actualizar `CLAUDE.md` (tablas nuevas, rutas `/groups`·`/teams`, `patients.team_id`, renombre) y completar este doc con lo ejecutado (versión de migración, verificaciones).
- Commit **como Jano, sin push** hasta OK.

---

## Pruebas mínimas (checklist tras la fase)
1. **Regresión individual (lo más importante):** paciente sin equipo → alta, anamnesis pública, valoración, documentos, informe → **todo igual que hoy**.
2. Crear **grupo** → **equipo** → **añadir jugador manual** → aparece en roster.
3. El jugador aparece en `/patients` con su equipo; la ficha muestra el bloque "Equipo".
4. **Filtros:** "por equipo" y "sin equipo" correctos.
5. **RLS / multi-tenant:** usuario de otra clínica no ve grupos/equipos ajenos (o verificar `pg_policies`).
6. **Ajustes:** la pestaña dice "Personal"; invitar/gestionar staff sigue igual.
7. `npm run build` verde.

---

## Notas / riesgos
- **Deploy:** todo aditivo → sin orden deploy-first (a diferencia de la Fase D). Nada rompe el flujo individual mientras `team_id` sea NULL en los pacientes existentes.
- **RLS deny-all:** el único fallo silencioso posible es olvidar las policies en A1 → tablas bloqueadas. Verificar `pg_policies` tras A1.
- **Rutas y guard:** `/groups` y `/teams` quedan protegidas por el guard del layout `(dashboard)`. Opcional: añadirlas a `isProtectedRoute` del middleware (defensa en profundidad).
- **Alta manual:** reutilizar `patients/new` (comprobar cómo crea hoy el paciente y pasar `team_id`).

---

## Registro de ejecución
_(Se completa a medida que se ejecutan las tareas.)_

- **A1** — ✅ **HECHA (2026-07-25).** Migración `20260725152017_create_groups_teams_and_patient_team_link` aplicada vía MCP `apply_migration` (archivo repo con el mismo nombre). Creadas `groups` y `teams`; `patients.team_id` uuid NULLABLE (FK→teams ON DELETE SET NULL). Índices + triggers `updated_at`. RLS ON + policies `FOR ALL` clínica-scoped (USING+WITH CHECK) en ambas (verificado en `pg_policies` → no deny-all). Tipos regenerados (`database.generated.ts` incluye groups/teams/patients.team_id) + alias `Group`/`Team` en `database.ts`. `npm run build` OK. **Sin commit / sin push** (pendiente de OK).
- **A2** — ✅ **HECHA (2026-07-25).** Páginas `/(dashboard)/groups/page.tsx` (lista de grupos + nº equipos + crear grupo) y `/(dashboard)/groups/[id]/page.tsx` (equipos del grupo + nº jugadores + crear equipo). Componentes client `components/teams/CreateGroupForm.tsx` y `CreateTeamForm.tsx` (patrón insert autenticado + `router.refresh()`). Server components `force-dynamic` filtrando `clinic_id` (defensa en profundidad). Middleware: `/groups` y `/teams` añadidas a `isProtectedRoute`. `npm run build` OK. Nota: las filas de equipo enlazan a `/teams/[id]` (404 hasta A3). Sin commit / sin push.
- **A3** — ✅ **HECHA (2026-07-25).** Roster `/(dashboard)/teams/[id]/page.tsx` (cabecera equipo+grupo, lista de jugadores con `computeStage` + línea clínica, botón "Añadir jugador", estado vacío). Alta manual: `patients/new` extendido para aceptar `?team_id=` (envuelto en `Suspense` por `useSearchParams`), muestra el equipo destino, fija `team_id` en el insert y **redirige al roster** tras crear. Enlace equipo→roster ya funciona (deja de ser 404). `npm run build` OK. Sin commit / sin push.
- **A4** — ✅ **HECHA (2026-07-25).** Ficha `/patients/[id]`: join a `teams(id,name,category)` + card **"Equipo"** en la columna derecha (link al roster) solo si el paciente tiene equipo. Lista `/patients`: filtro **por equipo / "Sin equipo"** — `PatientFilters` acepta prop `teams` (select + chip + activeCount), la página hace fetch de equipos (RLS los limita a la clínica), aplica `.eq('team_id', …)` / `.is('team_id', null)` y preserva `team` en el buscador. `npm run build` OK. Sin commit / sin push.
- **A5** — ✅ **HECHA (2026-07-25).** Ajustes: tab staff "Equipo" → **"Personal"** (label + heading `Personal (N)`; `id` interno `team` intacto). Sidebar: nueva entrada **"Equipos"** → `/groups` (icono `Shield`), tras "Pacientes". Nota: en móvil el bottom-nav (primeros 4) pasa a Inicio·Pacientes·Equipos·Informes; Actividad queda en el menú desplegable. Cosmético menor: "Equipos" no resalta en `/teams/[id]`. `npm run build` OK.
- **A6** — ✅ **HECHA (2026-07-25).** `CLAUDE.md` §17 nuevo (progreso Fase A). Doc de fase completado. Build verde. QA manual: ver checklist arriba (a ejecutar por el usuario en local/deploy). Commits: código A4+A5 y docs en commits separados (autor Jano, sin push).

**Fase A COMPLETADA.** Siguiente: Fase B (deportes y pruebas) — ver `PLAN-IMPLEMENTACION-EQUIPOS.md`.
