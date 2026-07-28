# SHERPA — Plan de implementación del flujo deportivo (Prompt 3)

> Plan faseado y accionable. **No contiene código ni SQL**; describe migraciones/tareas para ejecutar luego con Sonnet/Opus ("Prompt 4").
> Base: `CLAUDE.md` + `FASE-0-SANEAMIENTO.md` (Fase 0 CERRADA) + `DISENO-EQUIPOS.md`.
> Decisiones clínicas: **CERRADAS** (ver cabecera del Prompt 3). Requisito transversal: **el flujo individual actual sigue funcionando en todas las fases.**

## Decisiones fijadas (resumen operativo)
1. Alta jugadores: **manual desde equipo** + **CSV de un equipo**; enlace delegado → pospuesto.
2. Envío anamnesis: **manual** (enlace que el usuario comparte); diseño preparado para proveedor futuro, sin implementar.
3. Deporte: `teams.sport_id` (default) · `patients.sport_id` (override) · `sessions.sport_id` (override). Resolución `session ?? patient ?? team`.
4. VALD: **PDF adjunto** al contexto IA (vinculado a sesión/prueba); API futura; sin extracción compleja ahora.
5. Informe de equipo v1: **cualitativo + métricas básicas**.
6. Por prueba: `session_tests.notes` desde el inicio; `result_data` JSONB opcional futuro.
7. Consentimientos: **tabla dedicada** + flags en `anamnesis_forms` (trazabilidad).
8. Membresía: `patients.team_id` único (sin historial v1).
9. Informe equipo: `reports.scope` + `team_id` (sin tabla aparte).

---

## 1. Fases de alto nivel (refinadas)

| Fase | Objetivo | Riesgo | Criterio de "completada" |
|---|---|:--:|---|
| **A — Organización + roster** | Grupos/equipos + `patients.team_id` + alta manual + vista roster + renombres UX | 🟢 Bajo | Se crean grupos/equipos, se añade jugador manual, se ve el roster; **el flujo individual no cambia** (team_id NULL) |
| **B — Deportes y pruebas** | Catálogos `sports`/`tests` (+prompt por prueba) + `sport_tests` + `teams.sport_id`/`patients.sport_id` + config UI | 🟢 Bajo | La clínica configura deportes, pruebas y mapeo; sin efecto aún en la valoración |
| **C — Consentimientos y trazabilidad** | Tabla `consents` (tipo, versión de texto, timestamp) + wiring con anamnesis | 🟡 Bajo-medio | Cada consentimiento del paciente queda registrado con tipo/versión/fecha; anamnesis sigue funcionando |
| **D — Entidad Sesión + refactor valoración** | `sessions`/`session_tests` de primera clase; stepper por deporte; **migración `assessments`→`sessions`** | 🔴 **Alto** | Con flag ON, la valoración va por sesión (individual y jugador) con **paridad de UX**; con flag OFF, todo igual que hoy |
| **E — VALD por sesión + informe individual sobre sesión** | Docs por sesión/prueba; informe IA leyendo contexto de la sesión (anamnesis+pruebas+notas+VALD+prompts) | 🟡 Medio | Un informe individual se genera desde una sesión con su VALD y notas por prueba, revisable/PDF |
| **F — Súper informe de equipo** | `reports.scope='team'`; agregación IA cualitativa del equipo | 🟠 Medio-alto | Con el roster valorado, se genera informe de equipo revisable/PDF |
| **G — Alta masiva CSV (un equipo)** | Importador Excel/CSV de jugadores a un equipo | 🟡 Bajo-medio | Se cargan N jugadores de un fichero a un equipo con validación y previsualización |
| **(Pospuesto, diseño-only)** | Canales de envío (email/WhatsApp) + enlace delegado de alta | — | No se implementa; se deja el punto de extensión definido |

Dependencias: **A → (B, C, G en paralelo) → D → E → F**. G depende solo de A. C es prerequisito "blando" de D (el paso 1 de la sesión muestra consentimientos). B es prerequisito de D/E (pruebas por deporte).

---

## 2. Tareas por fase

### Fase A — Organización + roster (🟢)
**Migraciones**
- Crear `groups` (`id, clinic_id, name, notes, timestamps`) + FK a `clinics` + índice `clinic_id`.
- Crear `teams` (`id, clinic_id, group_id→groups, name, category, notes, timestamps`; `sport_id` se añade en B) + índices.
- `patients`: añadir `team_id` **NULLABLE** → `teams(id)` (ON DELETE SET NULL) + índice.
- **RLS**: policies clínica-scoped (SELECT/INSERT/UPDATE, o ALL) en `groups` y `teams` (`clinic_id = get_user_clinic_id()`). ⚠️ El trigger `ensure_rls` deja las tablas nuevas RLS-ON **sin policies (deny-all)** → escribir las policies en la MISMA migración.
- Regenerar `types/database.generated.ts` y derivar en `database.ts`.

**Código**
- Rutas server: `/groups` (lista+crear), `/groups/[id]` (equipos del grupo+crear equipo), `/teams/[id]` (roster).
- Helpers CRUD clínica-scoped (filtrar `clinic_id` en query además de RLS — defensa en profundidad).
- Alta manual de jugador desde `/teams/[id]`: reutiliza el alta de `patients` (`patients/new`) fijando `team_id`; datos mínimos (nombre, teléfono, email).
- Extender `patients/[id]` para mostrar bloque "Equipo" si `team_id` no es NULL (link al equipo).

**UX**
- **Renombrar** en Ajustes la pestaña "Equipo" (staff) → **"Personal"** (`SettingsClient` tab `team`→label "Personal").
- Añadir entrada **"Equipos"** en `Sidebar` (desktop + bottom-nav; revisar orden y móvil 4-slots).
- Filtro por equipo / "sin equipo" en la lista de `/patients`.

**Pruebas / regresión mínima**
- Paciente suelto (sin equipo): alta, ficha, anamnesis, valoración, informe → **todo igual que hoy**.
- Crear grupo → equipo → añadir jugador → aparece en roster y en `/patients` con su equipo.
- Aislamiento multi-clínica: usuario de otra clínica no ve grupos/equipos ajenos (RLS).
- `npm run build` OK.

### Fase B — Deportes y pruebas (🟢)
**Migraciones**
- Crear `sports` (`id, clinic_id, name, slug, description, is_active, timestamps`).
- Crear `tests` (`id, clinic_id, name, slug, description, vald_interpretation_prompt TEXT, result_schema JSONB null, is_active, timestamps`).
- Crear `sport_tests` (`id, clinic_id, sport_id→sports, test_id→tests, display_order, is_required, timestamps`) + UNIQUE(sport_id,test_id).
- `teams`: añadir `sport_id` NULLABLE → `sports`. `patients`: añadir `sport_id` NULLABLE → `sports` (override).
- **RLS** clínica-scoped en `sports`, `tests`, `sport_tests` (mismo patrón + recordatorio deny-all).
- Regenerar tipos.

**Código / UX**
- Ajustes → **"Deportes y pruebas"** (`/settings/sports`, `/settings/tests`): CRUD de deportes, CRUD de pruebas (con campo `vald_interpretation_prompt`), y editor de mapeo deporte→pruebas (`sport_tests`, con orden y "requerida").
- Selector de deporte en la edición de equipo (`teams.sport_id`) y opción de override en ficha de paciente (`patients.sport_id`).
- Helper puro `resolveSport(session, patient, team)` (aún sin consumidor hasta D).

**Pruebas**
- Crear deporte "fútbol", pruebas 1/4/8, mapear; editar; desactivar. Sin efecto en valoración todavía.
- Asignar deporte a un equipo y override a un paciente; verificar persistencia.
- Build OK.

### Fase C — Consentimientos y trazabilidad (🟡 bajo-medio)
**Migraciones**
- Crear `consents` (`id, clinic_id, patient_id→patients, anamnesis_id→anamnesis_forms null, type ('data_processing'|'info_treatment'|'ai_analysis'), granted bool, version_label, version_text TEXT, granted_at, created_at`).
- **RLS** clínica-scoped + acceso por service_role para el guardado desde el enlace público (patrón anamnesis; **nunca `USING(true)`**).
- Mantener los flags actuales en `anamnesis_forms` (compatibilidad) → los nuevos consentimientos se **duplican** en `consents` para trazabilidad.
- Regenerar tipos.

**Código / UX**
- Ajustes → **"Consentimientos"**: gestión de los textos/versiones de cada tipo (los `version_text`/`version_label` vigentes).
- Endpoint público de anamnesis (`/api/anamnesis/[token]`): al aceptar consentimientos, **registrar filas en `consents`** (service_role) además de los flags.
- En la sesión (Fase D) el paso 1 mostrará los consentimientos aceptados (tipo/versión/fecha).

**Pruebas**
- Rellenar anamnesis pública aceptando los 3 consentimientos → aparecen 3 filas en `consents` con versión y timestamp; los flags de `anamnesis_forms` siguen correctos.
- Cambiar el texto de una versión no altera consentimientos ya registrados (trazabilidad).
- Build OK.

### Fase D — Entidad Sesión + refactor de valoración (🔴 ALTO)
> La fase sensible. Estrategia: **copiar, no mover**; **feature-flag**; **paridad de UX**.

**Migraciones**
- Crear `sessions` (`id, clinic_id, patient_id→patients, physio_id→users, sport_id NULLABLE→sports, session_number, status ('draft'|'in_progress'|'completed'|'report_generated'), current_step, clinical_data JSONB, notes, scheduled_at, started_at, completed_at, timestamps`).
- Crear `session_tests` (`id, clinic_id, session_id→sessions (ON DELETE CASCADE), test_id→tests, status ('pending'|'done'|'skipped'), notes TEXT, result_data JSONB null, timestamps`).
- `reports`: añadir `session_id` NULLABLE→sessions (para el informe individual por sesión; el resto en E/F).
- **RLS** clínica-scoped en `sessions`/`session_tests` (recordatorio deny-all).
- **NO** borrar ni vaciar `assessments` (se conserva como fallback y origen del backfill).
- Regenerar tipos.

**Migración de datos (backfill) — NO destructiva**
- Script/migración que, por cada `assessments` existente, **crea** una `session`: `patient_id`, `physio_id`, `status` (map: in_progress→in_progress, completed→completed), `session_number`, `clinical_data = assessment.assessment_data`, `notes = assessment.notes`, timestamps.
- Repuntar `reports.session_id` desde `reports.assessment_id` (misma sesión creada).
- `patients.vald_interpretation` (legacy): se **conserva** en el paciente; a futuro las notas viven por prueba. Documentar el mapeo.
- Verificación de backfill: nº de sessions creadas == nº de assessments; spot-check de 2-3 pacientes; reports enlazados.

**Código**
- Nueva ficha de valoración basada en **sesión**: `/patients/[id]/sessions/[sessionId]` con **stepper derivado del deporte**: (1) revisar anamnesis + consentimientos, (2) pruebas resueltas por `resolveSport` → `sport_tests`, (3) notas por prueba (`session_tests.notes`), (4) adjuntar VALD/imágenes, (5) generar informe.
- "Iniciar/continuar valoración" en `/patients/[id]` crea/abre una `session` (en vez de `assessment`).
- Migrar el formulario de 84 campos + dictado al contexto de sesión (`clinical_data`).
- Deporte no resuelto (paciente sin equipo/deporte) → stepper muestra "sin pruebas configuradas / selección manual", **no bloquea**.
- `stage.ts` → *session-aware* (deriva etapa desde la última sesión).

**Feature-flag**
- Flag `SESSIONS_ENABLED` (env o setting de clínica). OFF → ficha antigua (lee `assessments`). ON → ficha nueva (lee `sessions`). Permite activar por clínica y **revertir** sin migración inversa.

**Pruebas / regresión (exhaustivas)**
- Flag OFF: el flujo individual antiguo intacto (assessments, informe, PDF).
- Flag ON, paciente **suelto sin deporte**: crear sesión, sin pruebas, notas generales, informe → funciona.
- Flag ON, **jugador con deporte de equipo**: la sesión muestra las pruebas del deporte; notas por prueba; adjuntar VALD; informe.
- Backfill: pacientes con valoración previa muestran su sesión con los mismos datos; informes antiguos siguen abriéndose.
- Build OK.

### Fase E — VALD por sesión + informe individual sobre sesión (🟡 Medio)
**Migraciones**
- `documents`: añadir `session_id` NULLABLE→sessions y `session_test_id` NULLABLE→session_tests (se conserva `patient_id`).
- Regenerar tipos.

**Código**
- Subida de VALD/imágenes desde la sesión → set `session_id`/`session_test_id`.
- Reescribir el **constructor de contexto IA** de `reports/generate` para leer de la **sesión**: anamnesis + `session_tests` (pruebas + notas) + `tests.vald_interpretation_prompt` por prueba + documentos VALD vinculados. Set `reports.session_id`.
- Mantener la estructura de informe cerrada + revisión humana + export PDF (reutilizados).

**Pruebas**
- Sesión con 2 pruebas, notas y un PDF VALD por prueba → el informe recibe las notas y los prompts por prueba; revisión y PDF OK.
- Paciente sin VALD → informe se genera igualmente.
- Build OK.

### Fase F — Súper informe de equipo (🟠 Medio-alto)
**Migraciones**
- `reports`: añadir `scope ('individual'|'team')` (default 'individual') y `team_id` NULLABLE→teams. Informe de equipo: `scope='team'`, `team_id` set, `patient_id` NULL.
- Regenerar tipos.

**Código / UX**
- Estado de equipo "valorado" (derivado: todos los jugadores del roster con sesión completada/informe). Botón "Generar súper informe" en `/teams/[id]` habilitado cuando aplica.
- `reports/generate` (o endpoint nuevo `team-generate`): agrega los informes/sesiones de los jugadores → prompt de equipo **cualitativo v1** (estado general, hallazgos agrupados, riesgos/fortalezas, recomendaciones) → `reports` scope='team' → revisión humana → PDF.
- Vista `/teams/[id]/report`.

**Pruebas**
- Equipo con 3 jugadores valorados → informe de equipo coherente, revisable, PDF.
- Equipo con jugadores sin valorar → botón deshabilitado / aviso.
- Build OK.

### Fase G — Alta masiva CSV de un equipo (🟡 Bajo-medio)
**Código / UX**
- En `/teams/[id]`: importador CSV/Excel → parseo cliente/servidor, **previsualización** con validación (nombre/teléfono/email), detección de duplicados, y creación en lote de `patients` con `team_id` fijado.
- Sin migración nueva (usa `patients`). Reutiliza el alta.

**Pruebas**
- Importar 10 jugadores; fila inválida marcada; duplicado no re-creado; todos con el `team_id` correcto.

### (Pospuesto — diseño-only) Canales de envío + enlace delegado
- Definir interfaz de "proveedor de envío" (email/WhatsApp) detrás del generador de enlace actual; no implementar hasta que haya decisión de proveedor/coste.
- Enlace delegado de alta (token+service_role, patrón anamnesis) → cuando se retome el intake avanzado.

---

## 3. Riesgos y salvaguardas por fase

| Fase | Qué puede romper el flujo individual | Salvaguardas |
|---|---|---|
| A | Casi nada (aditivo). Riesgo real: el **renombre** de "Equipo"(staff) y el nuevo item de sidebar podrían confundir | `team_id` NULLABLE; no se toca el workflow de la ficha; QA del caso suelto; el renombre es solo label |
| B | Nada en runtime (config inerte) | Aditivo; `sport_id` nullable; `resolveSport` sin consumidor hasta D |
| C | El endpoint público de anamnesis se toca (registrar `consents`) | No abrir RLS (`USING(true)` prohibido); mantener flags actuales; el registro de consents es additivo al PATCH existente; probar el flujo público end-to-end |
| **D** | **La más peligrosa:** repunta la ficha de valoración de `assessments` a `sessions` | (1) **Backfill copia, no mueve** → `assessments` intacto; (2) **feature-flag** por clínica, reversible sin migración inversa; (3) paridad de UX antes de activar; (4) verificación de backfill (conteos + spot-check); (5) sesión tolera "sin deporte"; (6) aplicar el repunte de UI **tras desplegar** (lección Fase 0: DDL aditivo se puede aplicar antes; el cambio acoplado UI↔datos requiere deploy-first) |
| E | Cambia el constructor de contexto IA y la subida de documentos | Mantener compat: `documents.patient_id` se conserva; el generador tolera sesiones sin VALD; probar con y sin documentos |
| F | Producto nuevo; bajo riesgo para el individual (scope separado) | `scope` default 'individual' → informes actuales no cambian; el de equipo es camino nuevo |
| G | Alta en lote podría crear datos sucios | Previsualización + validación + detección de duplicados antes de commit; import atómico por equipo |

**Migraciones difíciles de revertir:** ninguna es destructiva si se respeta "copiar, no mover" en D. Toda tabla nueva es aditiva (drop = reversible). El único punto con datos es el backfill de D → mitigado porque `assessments` se conserva y el flag controla qué lee la UI. Recomendado: **snapshot/backup de la DB antes del backfill de D** (aunque sea no destructivo).

**Compatibilidad de datos (transversal):** `team_id`/`sport_id` NULLABLE; `resolveSport` con fallback a NULL sin romper; sesiones válidas para pacientes sin equipo; `reports.scope` default individual; `documents.patient_id` siempre presente.

---

## 4. Plan de uso de Claude Code (Opus / Sonnet)

**Reparto por tipo de trabajo**
- **Opus** (razonamiento, diseño delicado): arranque de cada fase (desglose fino + diseño de DDL/policies), y **toda la Fase D** (diseño del backfill, feature-flag, estrategia de paridad y verificación). También el diseño del prompt de IA del informe de equipo (F).
- **Sonnet** (implementación escalonada): tareas ya especificadas — páginas CRUD (A), config UIs (B), importador CSV (G), edición de componentes/rutas, y aplicar migraciones aditivas bien definidas. Rápido y suficiente cuando el diseño ya está fijado.

**Estilo de prompt por tarea ("Prompt 4", el que ya usamos)**
1. Acota **una** tarea de la fase (no mezclar fases).
2. Pide el ritual: *relee `CLAUDE.md`/plan → identifica archivos exactos → explica qué hará y por qué es seguro → implementa cambios mínimos → cómo probar → resumen (cambios/riesgos/siguientes pasos)*.
3. Reglas fijas: no ampliar alcance; no romper el flujo individual; migraciones vía MCP **`apply_migration`** (canónico) + regenerar `types/database.generated.ts`; `npm run build` verde antes de cerrar; **commit como Jano, sin push** hasta tu OK; y en cambios acoplados UI↔DB, **deploy antes** de aplicar el borrado/repunte (como en Fase 0 Tarea 4).
4. Aplicar migraciones **aditivas** puede hacerse antes de desplegar; los **repuntes acoplados** (D) requieren orden deploy-first.

**Cadencia recomendada por fase**
- *Kickoff (Opus):* "Diseña el desglose de la Fase X + DDL/policies + orden de tareas" → produce un mini-plan de la fase.
- *Ejecución (Sonnet):* una tarea por prompt, en el orden del mini-plan.
- *Cierre (cualquiera):* actualizar `CLAUDE.md` (modelo/rutas/UX nuevas) y crear/actualizar un doc por fase (`FASE-A-EQUIPOS.md`, etc.) con lo hecho, migraciones aplicadas (versiones), y verificaciones. Commit de docs como Jano.

**Higiene de datos/seguridad (heredada de Fase 0)**
- MCP: se mantiene en escritura mientras haya fases con migraciones; `apply_migration` para cada cambio (queda en historial) + regenerar tipos.
- Nunca `USING(true)`; toda tabla nueva necesita sus policies en la misma migración (recordar `ensure_rls` = deny-all por defecto).
- Un cambio de esquema = una migración versionada + su archivo en el repo con el mismo nombre de versión.

---

## 5. Orden recomendado, atajos y qué posponer

**Orden núcleo:** A → B → C → **D** → E → F. (G y "canales" fuera de la ruta crítica.)

**Atajos / valor rápido**
- **Enviar A sola a producción** ya da valor: gestionar grupos/equipos y ver rosters, sin sesiones ni deportes. Es el "quick win" de menor riesgo.
- **B y C son independientes y aditivos** → se pueden hacer en paralelo tras A; C debe estar antes de activar el paso 1 de la sesión (D).
- Dentro de D, se puede **partir** aún más: (D1) tablas+backfill+lectura tras flag; (D2) stepper por deporte; (D3) migrar el formulario de 84 campos. Activar el flag solo al terminar D2/D3 con paridad.

**Qué posponer (hasta feedback/estabilidad real)**
- **G (CSV):** útil, pero hasta que haya equipos reales que cargar en lote. Primero valida el alta manual (A).
- **Canales de envío (email/WhatsApp) y enlace delegado:** posponer; mantener el envío manual. Solo diseño ahora.
- **F (informe de equipo):** tiene más valor cuando ya existan varios informes individuales reales en prod y el pipeline individual (E) esté sólido (recordar: hoy `reports=0` en prod → primero hay que ejercitar el flujo individual de verdad).
- **Deuda P2 de seguridad** (`search_path`, `REVOKE EXECUTE`): no bloqueante; encajarla en cualquier hueco entre fases.

**Tarea crítica a ejecutar con SHERPA estable / ventana tranquila**
- El **backfill de D (`assessments`→`sessions`)**: aunque es no destructivo, repunta el flujo central. Hacerlo con poca actividad y snapshot previo. No mezclarlo con otras fases en el mismo despliegue.

---

## Resumen para arrancar
1. **Fase A** como primer bloque (quick win, riesgo bajo).
2. Cada fase: **kickoff con Opus** (desglose + DDL/policies) → **ejecución con Sonnet** (tarea a tarea, ritual Prompt 4) → **cierre** (docs + commit Jano).
3. **Fase D** es el punto de máximo cuidado: copiar-no-mover + feature-flag + paridad + verificación + deploy-first en el repunte.
4. Posponer G, canales y F hasta tener valor/uso real; nunca romper el caso individual (NULLABLE + fallbacks + flag).

---

## Adenda — Fase de Campañas + reordenación (2026-07)

Nueva entidad **campaña** (ver adenda de `DISENO-EQUIPOS.md`): estudio de valoración de un grupo (subconjunto de equipos), con inicio/fin previsto y seguimientos, que **agrupa** las sesiones del estudio. Reordenación de las fases posteriores a D:

- **D — Entidad Sesión (valoración individual como sesión).** Objetivo sin cambios; la sesión es **campaña-agnóstica** (`campaign_id` se añade en E, nullable → individual = null). El stepper de sesión se **reutiliza** para individual y campaña.
- **E — Campañas (NUEVA):**
  - E1: `campaigns` + `campaign_teams` + `sessions.campaign_id` + RLS + tipos.
  - E2: UI de campañas — crear (grupo + equipos + inicio/fin previsto + nº seguimientos), lista, vista de campaña (equipos incluidos + roster + **progreso** de valoración).
  - E3: valorar **dentro de campaña** — desde la campaña "valorar jugador" crea una `session` con `campaign_id`; soporta **seguimientos** (varias sesiones por jugador).
- **F — VALD por sesión + informe individual sobre sesión** (antes E).
- **G — Informe de CAMPAÑA** (antes "informe de equipo"): agrega las sesiones de una campaña (por equipo/posición/edad si aplica), cualitativo v1.
- **H — Alta masiva CSV** (antes G).

**Orden:** A·B·C (hechas) → **D** (sesión individual) → **E** (campañas) → F (VALD/informe individual) → G (informe de campaña) → H (CSV). El caso individual intacto en todas (`campaign_id`/`team_id`/`sport_id` NULLABLE).
