# SHERPA — Diseño del flujo deportivo (grupos / equipos / sesiones)

> Documento de diseño y planificación (Prompt 2). **No implementa nada.**
> Base: `CLAUDE.md` (SHERPA hoy) + `FASE-0-SANEAMIENTO.md` (Fase 0 cerrada) + hoja de requisitos funcionales (estado objetivo).
> Requisito de diseño transversal: **el flujo individual actual debe seguir funcionando** en todas las fases.
> Convención: entidades/decisiones abiertas se marcan **[DECISIÓN CLÍNICA]**.

---

## 1. Estado actual vs objetivo — gap analysis

### 1.1 SHERPA hoy (condensado)
- **Dominio:** paciente individual. Tablas: `clinics, users, patients, anamnesis_forms, assessments, audio_recordings, documents, reports` (+ clasificación en `patients`). Multi-tenant por `clinic_id` + RLS.
- **Flujo:** paciente → anamnesis por enlace/token (pública, service_role) → valoración (`assessments`, 84 campos JSONB + dictado) → documentos VALD (PDFs) + imágenes (`documents`) + `patients.vald_interpretation` → informe IA (Claude Sonnet, estructura cerrada) → revisión humana → aprobar → PDF.
- **UX:** sidebar plano (Inicio, Pacientes, Informes, Actividad, Ajustes). Toda la operativa vive en `/patients/[id]` como **5 pasos cableados**. No hay entidad "sesión" navegable (`assessments.session_number` existe pero se usa como una sola). "Equipo" en Ajustes = **staff de la clínica**.
- **Sin:** grupos, equipos, deportes, catálogo de pruebas, relación deporte→prueba, informe de equipo, jerarquía organizativa.

### 1.2 Flujo objetivo (condensado, de la hoja de requisitos)
Grupos → equipos → jugadores(=pacientes) vinculados; alta de jugadores (manual/CSV/enlace delegado); envío previo de anamnesis + **3 consentimientos** (datos, tratamiento de la información, IA); **sesión** de valoración guiada por pasos (revisar anamnesis → pruebas **según deporte** → notas por prueba → adjuntar PDF VALD → informe IA individual revisable); y **súper informe de equipo** agregado cuando el equipo está valorado. Conviven pacientes sueltos sin equipo.

### 1.3 Gap analysis

**✅ Ya existe y se REUTILIZA (poco o ningún cambio):**
| Pieza | Reutilización |
|---|---|
| `clinics`, `users`, RLS + `get_user_clinic_id()` | Base multi-tenant; las tablas nuevas la heredan |
| `patients` | Sigue siendo la entidad jugador/paciente (se **extiende**, no se sustituye) |
| `anamnesis_forms` + flujo público por token (service_role) | **Se reutiliza tal cual** para la anamnesis del jugador; ya soporta consentimientos |
| `documents` + Storage + signed URLs | Adjuntar PDFs VALD e imágenes; se **extiende** el vínculo (a sesión/prueba) |
| `reports` + revisión humana + export PDF + patrón IA (Anthropic) | El informe individual; se **extiende** para vincular a sesión y para el informe de equipo |
| `lib/clinical/taxonomy.ts`, clasificación IA, `stage.ts` | Reutilizables; `stage` se hace *session-aware* |
| Dashboard / Actividad (shells) | Se reutilizan y se les añade dimensión de equipo |

**🟠 Necesita REFACTOR:**
| Pieza | Refactor |
|---|---|
| `assessments` (5 pasos hardcodeados en la ficha) | Pasa a ser **contenido clínico de una `session`**; los pasos dejan de estar cableados y se derivan del deporte |
| Notas VALD (`patients.vald_interpretation`, notas por documento) | Evolucionan a **notas por prueba** dentro de la sesión (`session_tests`) |
| "Pacientes" sobrecargado | Se separa: capa organizativa (Equipos) vs CRM de paciente vs Sesiones |
| Ajustes → pestaña "Equipo" (staff) | **Renombrar** (colisión con "Equipos" deportivos) |
| `documents` / `reports` | Añadir `session_id` (y `session_test_id` en docs) nullable |
| Constructor de contexto IA en `reports/generate` | Pasar de concatenar campos del paciente a **estructura por sesión** (anamnesis + pruebas + notas por prueba + VALD) |

**🆕 NUEVO (no existe nada):**
`groups`, `teams`, `sports`, `tests`, `sport_tests`, `sessions`, `session_tests`, informe de equipo (entidad + agregación IA), lógica de resolución de deporte, UIs de configuración (deportes/pruebas), vista de roster, vista de sesiones, import CSV, enlace delegado de alta, canales de envío (email/WhatsApp).

**❓ DECISIONES ABIERTAS que bloquean detalle técnico:** ver §5. Las principales: mecanismo de alta de jugadores, canal de envío, **dónde vive el deporte**, papel del PDF VALD en el pipeline IA, y contenido del informe de equipo (define qué datos hay que capturar).

---

## 2. Modelo de dominio propuesto

### 2.1 Principio de compatibilidad
Todo lo nuevo es **aditivo y opcional**. El vínculo jugador↔equipo es **`patients.team_id` NULLABLE**: `NULL` = paciente individual (flujo antiguo intacto). La resolución de deporte y la sesión tienen *fallbacks* que no rompen el caso suelto.

### 2.2 Tablas nuevas (columnas clave)

**`groups`** — capa organizativa superior (ej. "Cádiz")
`id, clinic_id (FK), name, notes, created_at, updated_at`

**`teams`** — equipo dentro de un grupo (ej. "Cádiz A", "benjamines")
`id, clinic_id (FK), group_id (FK groups), name, category (opcional: benjamín/cadete…), sport_id (FK sports, NULLABLE) [DECISIÓN CLÍNICA: deporte a nivel equipo], notes, created_at, updated_at`

**`sports`** — catálogo de deportes (clinic-scoped)
`id, clinic_id (FK), name, slug, description, is_active, created_at`

**`tests`** — catálogo de pruebas disponibles
`id, clinic_id (FK), name, slug, description, vald_interpretation_prompt (TEXT) [requisito: "un prompt por prueba de cómo interpretar VALD"], result_schema (JSONB, futuro, opcional), is_active, created_at`

**`sport_tests`** — relación deporte→pruebas (N:M) (ej. fútbol → 1,4,8)
`id, clinic_id (FK), sport_id (FK), test_id (FK), display_order, is_required (bool), created_at` · UNIQUE(sport_id, test_id)

**`sessions`** — **valoración como entidad de primera clase**
`id, clinic_id (FK), patient_id (FK), physio_id (FK users), sport_id (FK sports, NULLABLE, resuelto/override), session_number, status (enum: 'draft'|'in_progress'|'completed'|'report_generated'), current_step (opcional, para el stepper), clinical_data (JSONB — la exploración tipo 84 campos), notes, scheduled_at, started_at, completed_at, created_at, updated_at`

**`session_tests`** — pruebas realizadas dentro de una sesión + **notas por prueba**
`id, clinic_id (FK), session_id (FK), test_id (FK), status (enum: 'pending'|'done'|'skipped'), notes (TEXT — la interpretación del fisio por prueba), result_data (JSONB, futuro estructurado), created_at, updated_at`

### 2.3 Extensiones a tablas actuales
- **`patients`**: `+ team_id (FK teams, NULLABLE)`, `+ sport_id (FK sports, NULLABLE)` [override individual], y **[DECISIÓN CLÍNICA]** posibles `position`, `category`, `dominant_side` si el informe de equipo los necesita (§5).
- **`documents`**: `+ session_id (FK sessions, NULLABLE)`, `+ session_test_id (FK session_tests, NULLABLE)`. Se conserva `patient_id` (compatibilidad).
- **`reports`**: `+ session_id (FK sessions, NULLABLE)`, `+ scope (enum: 'individual'|'team', default 'individual')`, `+ team_id (FK teams, NULLABLE)`. Un informe de equipo tiene `scope='team'`, `team_id` set, `patient_id` NULL.
  - *Alternativa:* tabla separada `team_reports`. Recomendación: reutilizar `reports` con `scope` para no duplicar la maquinaria de revisión/PDF. **[DECISIÓN abierta menor]**
- **`assessments`** (legacy): dos caminos posibles (§4 Fase C) — (a) **absorber** su rol en `sessions.clinical_data` y migrar los registros existentes a una `session` cada uno; o (b) mantener `assessments` con `+ session_id` 1:1. Recomendación: **(a) absorber**, para que "sesión" sea la única entidad y no haya dos conceptos solapados. Migración de datos incluida.

### 2.4 Relaciones (vista ER simplificada)

```
clinics 1─┬─* groups 1─* teams 1─* patients(team_id?) 1─* sessions 1─* session_tests *─1 tests
          │                    │                              │                 
          │                    └─(sport_id?)─* sports *─* sport_tests *─1 tests
          │                                        ▲
          │              patients(sport_id?)───────┤ (override individual)
          │              sessions(sport_id?)───────┘ (override en sesión)
          │
          ├─* patients ─1─* anamnesis_forms   (reutilizado)
          ├─* sessions ─1─* documents(session_id?/session_test_id?)   (VALD PDFs, imágenes)
          └─* reports(scope: individual→session_id | team→team_id)
```

**Resolución del deporte (para derivar las pruebas de una sesión)** — recomendada:
`session.sport_id ?? patient.sport_id ?? team.sport_id` (primer no-nulo gana). Cubre: jugador de equipo (hereda del equipo), paciente suelto (deporte propio o ninguno), y override puntual en la sesión. **[DECISIÓN CLÍNICA: confirmar este grano y orden]**

### 2.5 RLS / multi-tenant
- **Todas** las tablas nuevas llevan `clinic_id` + policies clínica-scoped (`clinic_id = get_user_clinic_id()`), como el resto.
- ⚠️ Recordatorio de `CLAUDE.md`: el event trigger `ensure_rls` activa RLS en toda tabla nueva de `public`, **pero no crea policies** → cada tabla nueva nace RLS-ON + **deny-all** hasta añadir sus policies explícitas. Hay que escribirlas en la misma migración que crea la tabla.
- `sessions`/`session_tests`/`documents`/`reports` ya cuelgan de `patient`/`clinic`; mantener el patrón de **filtrar `clinic_id` en la query además de RLS** (defensa en profundidad) en las páginas server nuevas.
- El alta por **enlace delegado** (si se aprueba) necesitará un patrón token+service_role como el de anamnesis (nunca abrir RLS con `USING(true)` — lección de Fase 0).

---

## 3. Arquitectura de información / UX propuesta

### 3.1 Resolver la colisión de nombres
- **"Equipo" (staff)** → renombrar en Ajustes a **"Personal"** (o "Staff / Equipo de la clínica").
- **"Equipos" (deportivos)** → nueva sección de primer nivel.

### 3.2 Sidebar propuesta (evolución, no ruptura)
```
Inicio            (dashboard; añade agregación por equipo)
Pacientes         (todos; filtro por equipo / "sin equipo"); mantiene el flujo individual
Equipos           (NUEVO: grupos → equipos → roster)      ← capa organizativa
Sesiones          (NUEVO: valoraciones como lista navegable)  [opcional; ver 3.4]
Informes          (individuales + de equipo, con pestañas/filtro)
Actividad         (añade dimensión equipo/grupo/deporte)
Ajustes           (reorganizado, ver 3.3)
```
Móvil: bottom-nav sigue con 4 (Inicio, Pacientes, Equipos, Informes); Sesiones/Actividad/Ajustes en el menú.

### 3.3 Ajustes reorganizado
`Perfil · Clínica · Personal (staff, renombrado) · Deportes y pruebas (NUEVO) · Plantillas de informe (NUEVO) · Consentimientos (NUEVO, textos/versiones) · Informe (existente)`

### 3.4 Vistas clave y rutas principales
| Vista | Ruta propuesta | Contenido |
|---|---|---|
| Lista de grupos | `/groups` | Grupos de la clínica + alta |
| Detalle de grupo | `/groups/[id]` | Equipos del grupo |
| Detalle de equipo / **roster** | `/teams/[id]` | Jugadores + estado de valoración de cada uno + deporte + botón "generar súper informe" (cuando el equipo esté valorado) |
| Alta de jugadores | `/teams/[id]/players/new` (+ import CSV / enlace delegado) | **[DECISIÓN CLÍNICA]** mecanismo |
| Ficha de paciente | `/patients/[id]` (se mantiene) | Individual **y** jugador; muestra equipo (si tiene) + historial de **sesiones** |
| **Sesión (stepper)** | `/patients/[id]/sessions/[sessionId]` | Flujo guiado: 1) revisar anamnesis+consentimientos → 2) pruebas **según deporte** → 3) notas por prueba → 4) adjuntar PDF VALD/imágenes → 5) generar informe IA → revisión/aprobar/PDF |
| Informe individual | `/patients/[id]/sessions/[sessionId]/report` | Como hoy pero ligado a la sesión |
| Informe de equipo | `/teams/[id]/report` | Súper informe agregado + revisión humana + PDF |
| Config deportes/pruebas | `/settings/sports`, `/settings/tests` | Catálogos + relación deporte→prueba + **prompt por prueba** |

- **"Pacientes" se desahoga:** deja de ser el contenedor de todo; el workflow clínico vive en **Sesiones** (dentro de la ficha), y la organización en **Equipos**.
- La ficha individual del flujo antiguo sigue existiendo; para pacientes con `team_id` se enriquece con el bloque "Equipo" y la lista de sesiones. La entrada "Iniciar/continuar valoración" ahora crea/abre una **sesión**.

---

## 4. Estrategia de evolución incremental (fases/bloques)

Orden pensado para **minimizar riesgo**: primero lo aditivo-inerte (no toca el flujo antiguo), y al final lo sensible (la sesión). Cada fase es desplegable y reversible.

**Fase A — Capa organizativa (grupos/equipos) + RLS + roster.** *Riesgo: bajo (puro aditivo).*
- Tablas `groups`, `teams`; `patients.team_id` nullable. Policies clínica-scoped.
- Backoffice CRUD de grupos/equipos + **alta manual** de jugadores + vista roster.
- El flujo individual no se toca (`team_id` NULL). Nada del stepper cambia aún.

**Fase B — Configuración de deportes y pruebas.** *Riesgo: bajo (aditivo, sin efecto en runtime).*
- `sports`, `tests` (con `vald_interpretation_prompt`), `sport_tests`; UIs de config en Ajustes.
- `teams.sport_id` (y `patients.sport_id` si se aprueba override). Todavía sin impacto en la valoración.

**Fase C — Entidad Sesión + refactor de la valoración.** *Riesgo: ALTO (toca el flujo antiguo) → la fase que exige más cuidado.*
- Tablas `sessions`, `session_tests`. Lógica de resolución de deporte → listado de pruebas.
- Convertir los 5 pasos hardcodeados en un **stepper de sesión** derivado del deporte.
- **Migración de datos:** cada `assessment` existente → una `session` (con su `clinical_data`); `vald_interpretation`/notas → equivalente por prueba o nota general. El caso individual pasa a ir por una sesión **conservando la UX** (mismo aspecto de pasos).
- Salvaguardas: feature-flag de la nueva ficha; mantener rutas viejas hasta paridad; backfill verificado; pacientes sin deporte → sesión con lista de pruebas vacía/manual (no bloquea).

**Fase D — VALD por sesión/prueba + informe individual sobre sesión.** *Riesgo: medio.*
- `documents.session_id/session_test_id`; adjuntar PDFs a la sesión/prueba.
- `reports.session_id`; el constructor de contexto IA pasa a leer **anamnesis + pruebas + notas por prueba + VALD** de la sesión. Estructura de informe = plantilla de la clínica.
- **[DECISIÓN CLÍNICA]** papel del PDF (adjuntar vs extraer con IA vs esperar API).

**Fase E — Súper informe de equipo (IA agregada).** *Riesgo: medio-alto (producto nuevo).*
- `reports.scope='team'` (o `team_reports`). Agregación de las sesiones/informes de los jugadores del equipo → prompt de equipo → revisión humana → PDF.
- Requiere que el equipo esté "valorado" (estado derivado del roster). **[DECISIÓN CLÍNICA]** contenido/estadísticas.

**Fase F — Intake avanzado + canales de envío.** *Riesgo: variable, depende de decisiones.*
- Import **CSV** y/o **enlace delegado** (token+service_role) para alta masiva.
- Envío de anamnesis por **email/WhatsApp** (hoy es manual). Requiere infra externa (proveedor email / WhatsApp API). **[DECISIÓN CLÍNICA]** canal.

**Garantías transversales por fase:**
- *Individual sigue funcionando:* `team_id`/`sport_id` nullable + fallbacks; el stepper tolera "sin deporte".
- *Datos no se rompen:* cambios aditivos; la única migración destructiva-sensible (assessments→sessions, Fase C) va con backfill verificado y reversible.
- *UI no confunde:* la nueva navegación (Equipos/Sesiones) se introduce progresivamente; hasta Fase C la ficha individual se ve igual; naming de staff renombrado antes de introducir "Equipos".

---

## 5. Decisiones pendientes de validar con la clínica

Bloquean detalle técnico; conviene cerrarlas antes del Prompt 3 (implementación).

1. **Mecanismo de alta de jugadores** — manual / CSV / enlace delegado / mixto. → Afecta UX de roster, permisos y si hace falta infra de tokens delegados (Fase A/F).
2. **Canal de envío de anamnesis/consentimientos** — email / WhatsApp / mixto. → Hoy es manual (WhatsApp/copiar); automatizar exige proveedor email o WhatsApp API (Fase F).
3. **Dónde vive el "deporte principal"** — equipo / paciente / sesión / con override. → Recomendación técnica: **equipo por defecto + override en paciente y en sesión** (resolución §2.4). Confirmar grano.
4. **Papel del PDF de VALD en el pipeline IA** — adjuntar como referencia / extraer datos con IA antes del informe / esperar a la API. → Determina si hay que construir extracción de PDF (texto/visión) ahora (Fase D). Ojo: mucho contenido VALD es **gráfico**, no texto.
5. **Contenido del súper informe de equipo** — estadísticas agregadas, hallazgos, patrones/riesgos, clasificaciones por prueba/posición/edad/categoría, recomendaciones. → **Define qué datos hay que capturar** (p. ej. `position`/`category` en `patients`, resultados por prueba estructurados vs solo notas+PDF). Es la decisión que más condiciona el modelo (Fase E, y campos de §2.3).
6. **Grado de detalle del reporting/estadísticas** — ¿basta notas + PDF, o se necesita resultado numérico estructurado por prueba (`session_tests.result_data`, `tests.result_schema`) desde ya? → Afecta el esfuerzo de captura y si conviene anticipar estructura pensando en la futura API de VALD.
7. **Consentimientos y trazabilidad** — la hoja pide 3 consentimientos (datos, tratamiento de la información, IA) y enfatiza trazabilidad. ¿Basta con los flags en `anamnesis_forms` o se quiere una tabla `consents` con **versión de texto + timestamp + tipo** para auditoría? → Recomendación: tabla `consents` dedicada si la trazabilidad es requisito legal.
8. **Membresía jugador↔equipo** — ¿un jugador pertenece a **un** equipo a la vez (basta `team_id`) o hay que soportar **historial/traspasos/multi-equipo** (tabla `team_memberships`)? → Recomendación por defecto: `team_id` simple; pasar a tabla de membresía solo si se necesita historial.
9. **Informe de equipo: entidad** — reutilizar `reports` con `scope` (recomendado) vs tabla `team_reports` separada. Menor, pero conviene fijarlo.

---

## Resumen para el Prompt 3
- **Reutilizar** al máximo (anamnesis/token, documents/storage, reports/IA/PDF, RLS).
- **7 tablas nuevas** + extensiones nullable a `patients`/`documents`/`reports`; `team_id` nullable como palanca de compatibilidad.
- **Sesión = entidad de primera clase** (el mayor refactor, Fase C, con migración de `assessments`).
- **Navegación:** añadir "Equipos" (y opcional "Sesiones"), reorganizar Ajustes, renombrar staff.
- **Orden de fases A→F** de menor a mayor riesgo, individual intacto en todas.
- **9 decisiones** de clínica a cerrar; las #3, #4 y #5 son las que más condicionan el modelo.

---

## Adenda — Campañas (decisión de negocio, 2026-07)

**Problema detectado:** una sesión cuelga solo del paciente → al valorar un equipo, **nada agrupa** esas sesiones como "el estudio de ese equipo", y no se distingue una consulta de **campaña** de un **seguimiento individual**. El informe agregado necesita esa agrupación.

**Solución — entidad `campaigns` (campaña):** un estudio de valoración con contexto propio.

### Entidades nuevas
- **`campaigns`**: `id, clinic_id, group_id (FK groups, NOT NULL), name, status ('active'|'closed') default 'active', start_date (date), end_date_planned (date NULL — puede quedar abierta), planned_consultations (int NULL — nº de seguimientos previstos), closed_at (timestamptz NULL), notes, timestamps`.
- **`campaign_teams`**: N:M `campaign_id ↔ team_id` (subconjunto de los equipos del grupo; `UNIQUE(campaign_id, team_id)` + `clinic_id`).
- **`sessions.campaign_id`** NULLABLE → `campaigns(id)` ON DELETE SET NULL. **La clave:** sesión con campaña = parte del estudio; `null` = valoración individual (flujo antiguo intacto).

### Reglas confirmadas con la clínica
1. Una campaña = **un grupo**; incluye un **subconjunto** de sus equipos (no todos).
2. Una sesión pertenece **como mucho a una campaña**. Un jugador puede tener sesiones de campaña **y** sueltas.
3. Se valora a los jugadores de los equipos incluidos (todos o los que se presenten; normalmente todos). El "progreso" mide valorados vs roster.
4. La campaña tiene **inicio + fin previsto (opcional) + seguimientos previstos** → varias consultas por jugador a lo largo de la campaña = varias `sessions` (`session_number`).
5. Pueden coexistir **varias campañas** independientes.

### Impacto
- `sessions` gana `campaign_id` (nullable). Aditivo; el individual no cambia.
- El **informe agregado** deja de ser "de equipo" genérico → pasa a ser **por campaña** (agrega las sesiones de la campaña, por equipo/conjunto). Más sólido.
- Nueva capa de navegación **"Campañas"**: crear sobre un grupo → elegir equipos + fechas + seguimientos → valorar jugadores **en contexto**.
