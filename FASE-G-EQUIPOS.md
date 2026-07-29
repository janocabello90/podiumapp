# Fase G — Informe agregado de campaña (IA) — mini-plan

> Doc de la Fase G. **Producto nuevo:** un **súper-informe cualitativo** que agrega las sesiones de una **campaña** (Fase E) en un informe de conjunto, con revisión humana + PDF. Sucede a la Fase F (informe individual sobre sesión). Precede a la Fase H (alta masiva CSV).
> **Riesgo:** 🟠 medio-alto — estructura de informe nueva (distinta del individual), nuevo constructor de contexto que agrega N sesiones, y nueva superficie de revisión/PDF. Aditivo: `reports.scope` default `'individual'`; nada del flujo individual (Fases D/F) cambia.

## Por qué "de campaña" y no "de equipo"
La Fase E resolvió que lo que agrupa un estudio es la **campaña** (`sessions.campaign_id`), no el equipo suelto. Así que el informe agregado se genera **por campaña** (que ya define su grupo + subconjunto de equipos + ventana temporal). Dentro del informe se puede **desglosar por equipo** (y opcionalmente por franja de edad), pero la unidad de agregación y de scope es la campaña. Esto **actualiza** el término "súper informe de equipo" del diseño original (`DISENO-EQUIPOS.md` §Fase E / `PLAN-IMPLEMENTACION-EQUIPOS.md` Fase F): pasa a ser **informe de campaña**.

## Criterio de "completada"
Desde `/campaigns/[id]`, con al menos N jugadores valorados (sesión con `clinical_data`), se genera un **informe de campaña** (`reports.scope='campaign'`, `campaign_id` set, `patient_id` NULL) cualitativo v1 que agrega las sesiones de la campaña; es **revisable** (editar + aprobar) y **exportable a PDF**. El flujo individual intacto. `npm run build` verde.

---

## Decisión de producto que condiciona el alcance (v1)
- **No hay resultados estructurados de pruebas.** Hoy los datos de VALD/pruebas llegan como **texto**: `session_tests.notes` (notas por prueba), `tests.vald_interpretation_prompt` (guía por prueba), `patients.vald_interpretation` (interpretación del fisio) y `clinical_data` (84 campos de exploración). **No** hay parsing numérico de los PDFs de VALD.
- **Consecuencia:** el informe de campaña v1 es **cualitativo** (estado general, hallazgos agrupados, patrones/riesgos, fortalezas, recomendaciones colectivas + jugadores a vigilar). **No** promete estadísticas numéricas por prueba (asimetrías medias, percentiles): eso exige capturar resultados estructurados y queda **fuera de v1** (futuro: `session_tests.result_data` JSONB ya existe reservado).
- **Dimensiones de desglose v1:** por **equipo** (siempre; la campaña conoce sus `campaign_teams`) y por **franja de edad** (derivable de `patients.date_of_birth`, opcional). **`position`** no existe en `patients` → fuera de v1 (posible columna futura si se pide).

---

## Diseño de esquema (migración G1)
**`reports`** (aditivo):
- `+ scope text CHECK IN ('individual','campaign') DEFAULT 'individual'` (NOT NULL).
- `+ campaign_id uuid NULLABLE → campaigns(id) ON DELETE SET NULL`.
- **Relajar `patient_id` a NULLABLE** (hoy es NOT NULL): un informe de campaña no cuelga de un paciente. Se añade CHECK de coherencia:
  `CHECK ((scope='individual' AND patient_id IS NOT NULL) OR (scope='campaign' AND campaign_id IS NOT NULL))`.
- Índice `reports(campaign_id)` parcial where not null.
- RLS de `reports` no cambia (sigue clínica-scoped; el informe de campaña lleva `clinic_id`).
- Regenerar tipos + alias `Report` (recoge `scope`/`campaign_id`; `patient_id` nullable).

> Nota: se descarta `team_id` en `reports` (el diseño original lo mencionaba para "informe de equipo"); con campañas, `campaign_id` es la clave de scope. Un informe por equipo concreto se puede añadir luego como `campaign_id` + filtro, sin nueva columna.

---

## Estructura del `report_data` de campaña (JSON v1)
Distinta del individual. Secciones propuestas:
- `portada_intro`: introducción (grupo, equipos incluidos, ventana de la campaña, nº de jugadores valorados, metodología PODIUM aplicada a un colectivo).
- `resumen_campana`: resumen ejecutivo del estado global del colectivo.
- `hallazgos_por_equipo`: array `{ equipo, resumen, hallazgos[] }` — desglose por cada equipo de la campaña.
- `patrones_y_riesgos`: patrones transversales y riesgos (lesionales/carga) agrupados; siempre en lenguaje "posible/compatible con", sin diagnóstico.
- `fortalezas`: puntos fuertes del colectivo.
- `jugadores_a_vigilar`: array `{ nombre, equipo, motivo }` — jugadores que requieren atención/seguimiento individual (referencia a su informe individual, sin sustituirlo).
- `recomendaciones`: recomendaciones colectivas priorizadas (prevención, trabajo por grupos, seguimiento).
- `descargo`: descargo adaptado a informe colectivo (misma base legal + IA-asistido + revisión colegiada; añade que no sustituye la valoración individual de cada jugador).

---

## Tareas

### G1 — Migración + tipos
- `reports.scope` + `reports.campaign_id` + relajar `patient_id` NULLABLE + CHECK de coherencia + índice, vía `apply_migration`; archivo repo. Regenerar tipos + alias `Report`.
- **Aceptación:** columnas + CHECK (`information_schema`/`pg_constraint`), build OK; informes individuales existentes siguen válidos (`scope` default 'individual').

### G2 — Constructor de contexto agregado + endpoint
- `POST /api/reports/campaign-generate` (body `{ campaignId }`): auth + clínica; cargar campaña + `campaign_teams` + jugadores de esos equipos + **sesiones de la campaña** (`sessions.campaign_id = campaignId`, con `clinical_data`, `notes`, `session_tests` [notas + prompt por prueba], y `patients.vald_interpretation`). Construir un contexto **agregado y acotado** (resumir por jugador para no desbordar tokens; cap de jugadores/longitud). Llamar a Claude Sonnet con `SYSTEM_PROMPT` de campaña (estructura de arriba). Parsear JSON. Insertar `reports` `scope='campaign'`, `campaign_id`, `patient_id=null`, `status='draft'`.
- Reutilizar patrón del generador individual (modelo, parseo, manejo de errores). **Sin** fire-and-forget de clasificación (no aplica).
- **Aceptación:** campaña con ≥2 jugadores valorados → informe de campaña `draft` guardado con las secciones; campaña sin sesiones → 400/aviso controlado.

### G3 — Disparo + gating en la UI de campaña
- `/campaigns/[id]`: botón **"Generar informe de campaña"** (habilitado cuando `valorados >= 1`, idealmente todos; mostrar progreso). Estado de carga (30–90s). Al terminar → navegar a la revisión.
- **Aceptación:** botón deshabilitado/aviso si nadie valorado; genera y redirige cuando procede.

### G4 — Revisión + PDF del informe de campaña
- Vista `/campaigns/[id]/report`: renderiza el último informe `scope='campaign'` de la campaña; editor **cualitativo v1** (editar secciones de texto/arrays), **aprobar** (`status='approved'`), y **exportar PDF**.
- PDF: rama de campaña en `/api/reports/export-pdf` (o endpoint `export-pdf-campaign`) que maquete las secciones de campaña (portada + secciones + jugadores a vigilar + descargo). Reutilizar utilidades `jspdf`/`pdf-lib` existentes.
- **Aceptación:** editar + aprobar + PDF de un informe de campaña; el editor individual (`ReportEditor`) no se ve afectado.

### G5 — QA + docs + commit
- Checklist QA. `CLAUDE.md` §17 (Fase G) + cerrar este doc. Commits Jano (código + docs), **sin push** hasta confirmación.

---

## Navegación
- Informe de campaña colgado de la campaña: `/campaigns/[id]` (botón generar) → `/campaigns/[id]/report` (revisar/aprobar/PDF).
- `/campaigns` ya está en `isProtectedRoute` (Fase E); la subruta `/report` hereda la protección.

## Checklist de QA
1. **Regresión:** generar/editar/aprobar/PDF de un informe **individual** (Fases D/F) sigue igual; `reports.scope` de los existentes = 'individual'.
2. Campaña con 2–3 jugadores valorados (en 1–2 equipos) → generar informe de campaña → secciones coherentes, desglose por equipo, jugadores a vigilar.
3. Editar secciones + aprobar + exportar PDF de campaña.
4. Campaña sin nadie valorado → botón deshabilitado / aviso claro (no 500).
5. Coherencia de datos: informe de campaña con `patient_id` NULL, `campaign_id` set, `scope='campaign'` (CHECK no lo bloquea).
6. RLS: otra clínica no ve informes de campaña ajenos. `npm run build` verde.

## Notas / riesgos
- **Tokens:** una campaña puede tener muchos jugadores → **resumir por jugador** antes de agregar y **capar** longitud; considerar límite de jugadores en el prompt v1 (documentarlo).
- **Estructura nueva de `report_data`** → el editor/PDF individual NO sirve tal cual; se hace variante de campaña. Mantener el individual intacto (ramas separadas).
- **Sin estadística numérica** en v1 (no hay resultados estructurados). Futuro: capturar `session_tests.result_data` para métricas agregadas reales.
- **Aprobación/PDF**: reutilizar al máximo utilidades existentes; no rehacer el pipeline PDF entero.
- El informe de campaña **no sustituye** los informes individuales; los referencia (jugadores a vigilar).

---

## Decisiones (confirmadas 2026-07-29)
1. **Umbral de generación → PARCIAL con aviso.** Se puede generar con parte del roster valorado; el informe indica su cobertura (X de N jugadores). No se exige el 100%.
2. **Desglose → SOLO por equipo** en v1 (sin franjas de edad; se puede añadir luego sin tocar el modelo).
3. **Regeneración → VARIOS drafts** (histórico), se revisa el último. Igual que el informe individual. Beneficia a las campañas con seguimientos.
4. **PDF → maquetación MÍNIMA funcional v1** (portada sencilla + secciones + descargo, reutilizando utilidades existentes). Circuito completo generar → revisar → PDF desde v1.

---

## Registro de ejecución
- **G1** — ✅ **HECHA (2026-07-29).** `reports.scope` ('individual'|'campaign', default 'individual') + `reports.campaign_id` (FK→campaigns ON DELETE SET NULL) + `patient_id` relajado a NULLABLE + CHECK `reports_scope_check` y `reports_scope_coherence_check` + índice. Migración `20260729085432_add_campaign_scope_to_reports` (verificado: `patient_id` nullable, ambos CHECK, 0 informes existentes). Tipos regenerados + `ReportScope` + alias `Report` (scope tipado, campaign_id, patient_id nullable).
- **G2** — ✅ **HECHA (2026-07-29).** `POST /api/reports/campaign-generate`: agrega las sesiones de la campaña (resumen cualitativo por jugador: notas de valoración + notas por prueba + guía VALD + interpretación del fisio), cap `MAX_PLAYERS_IN_PROMPT=40`, Claude Sonnet con `SYSTEM_PROMPT` de campaña → `reports` `scope='campaign'`, `campaign_id`, `patient_id=null`, `status='draft'`. `report_data._meta` guarda cobertura (valorados/total, equipos, grupo). Avisos controlados: sin equipos / sin jugadores valorados → 400.
- **G3** — ✅ **HECHA (2026-07-29).** `CampaignReportButton` (cliente) en `/campaigns/[id]`: gating (deshabilitado si 0 valorados) + cobertura X/N + navega a la revisión al terminar. Tarjeta "Informe de campaña" con enlace al último informe (borrador/aprobado) si existe.
- **G4** — ✅ **HECHA (2026-07-29).** `/campaigns/[id]/report` (server) + `CampaignReportView` (cliente): edición de secciones (texto + hallazgos por equipo + jugadores a vigilar), **guardar** (PATCH `/api/reports/[id]`, genérico), **aprobar** (`status='approved'`), y **PDF** vía `POST /api/reports/export-pdf-campaign` (endpoint propio, jsPDF, maquetación mínima v1; NO toca el PDF individual). El editor individual (`ReportEditor`) intacto.
- **G5** — ✅ **HECHA (2026-07-29).** `CLAUDE.md` §17 (Fase G). Build OK (35 rutas, "Compiled successfully"). Commits Jano.

**Fase G COMPLETADA.** Siguiente: Fase H (alta masiva CSV de jugadores).
