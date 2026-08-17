# Generación de informes en segundo plano — Diseño

**Fecha:** 2026-08-14
**Estado:** diseño aprobado (pendiente de implementación)
**Ámbito:** generación de informes (individual y de equipo). Aditivo; el `report_data` resultante no cambia.

---

## 1. Resumen

Hoy la generación de informes (`/api/reports/generate` individual y `/api/reports/campaign-generate`
equipo) es **síncrona**: el cliente espera 1-3 min con streaming y, si cierra la página o se corta la
red, se aborta. Este diseño la pasa a **segundo plano**: al pulsar Generar se crea ya la fila `reports`
en estado **`generating`** y la petición **responde al instante**; la IA sigue por detrás (Vercel
`waitUntil`) y la fila pasa a **`draft`** (éxito) o **`error`** (fallo). El usuario puede **cerrar la
página**; al volver ve el estado, y la UI lo **sondea (polling)** para actualizarse sola.

## 2. Objetivos y no-objetivos

**Objetivos**
- Arrancar la generación y poder cerrar la página sin abortarla.
- Traza de estado en la app (`generating` / `draft` / `error`) con actualización por polling.
- Varios informes **distintos** en paralelo. Evitar duplicar el **mismo** informe.
- Aplicar a **individual y equipo** con el mismo mecanismo.

**No-objetivos (YAGNI)**
- **Cola durable** (Vercel Queues/Workflow): innecesaria al volumen actual y con `maxDuration` alto.
- **Tiempo real (Supabase Realtime)**: polling es suficiente para un proceso de minutos.
- **Notificaciones push/email** al terminar: v1 es aviso in-app (toast + estado).
- **Botón "generar todos los del equipo de golpe"** (batch masivo): otra feature; requeriría cola con tope de concurrencia.

## 3. Decisiones (log)

| # | Decisión | Elegido |
|---|----------|---------|
| 1 | Mecanismo de segundo plano | **Vercel `waitUntil`** + `maxDuration` alto (no cola) |
| 2 | Actualización de estado en UI | **Polling** (~4s), no realtime |
| 3 | Alcance | **Individual y equipo** (mismo patrón) |
| 4 | Estados | `generating` → `draft` / `error` |
| 5 | Aviso al terminar | **In-app** (toast + estado); sin push/email |

## 4. Arquitectura y ciclo de vida

```
Cliente pulsa Generar → POST /api/reports/generate (o /campaign-generate)
Ruta (parte SÍNCRONA, rápida):
  1. Auth + validación + candado de concurrencia
  2. Crea reports { status:'generating', ids coherentes }  → reportId
  3. waitUntil( trabajoEnSegundoPlano(reportId, …) )   (SIN await)
  4. return 202 { reportId, status:'generating' }
trabajoEnSegundoPlano (por detrás, hasta maxDuration):
  carga contexto (VALD, notas…) → Claude (streaming) → parsea → arma report_data →
  UPDATE fila: report_data + tokens + status='draft'
  (catch → UPDATE report_data={_error:'motivo'}, status='error')
```

- **`maxDuration`**: `export const maxDuration = 800` en ambas rutas (ajustable al máximo del plan). Los informes tardan 1-3 min → margen sobrado.
- **Sobrevive al cierre del cliente**: el trabajo vive en la función (waitUntil), no en el navegador.
- **Concurrencia**: cada Generar es una invocación independiente → varios informes distintos en paralelo. Vercel Fluid Compute lo gestiona.
- **Red de seguridad "atascado"**: si la función muriera antes de terminar, la fila quedaría en `generating`. Al leerla, si lleva `generating` más de un **umbral (15 min, > maxDuration)** se trata como **fallida** → la UI permite reintentar. No hay worker que lo flipee; es lógica de lectura.

## 5. Modelo de datos

- **`reports.status`**: ampliar el CHECK para admitir `error` → `generating | draft | approved | delivered | error`. (Ampliación segura; ninguna fila existente lo viola.)
- **Mensaje de error**: en `report_data._error` (texto). Sin columna nueva.
  - `generating` → `report_data = {}`.
  - éxito → `report_data = {…}`, `status='draft'`.
  - fallo → `report_data = { _error: 'motivo legible' }`, `status='error'`.
- **Fila coherente desde el inicio**: al crear se fijan los ids que exige el CHECK de coherencia — individual: `patient_id` + `session_id`; equipo: `campaign_id` + `team_id` + `campaign_round`.
- **Candado de concurrencia** (mismo informe): antes de crear, buscar una fila `generating` **reciente** (`created_at > now()-15min`) para el objetivo:
  - Individual: `session_id = X`.
  - Equipo: `campaign_id + team_id + campaign_round`.
  Si existe → **409 "ya se está generando"**. Si la que hay es antigua (atascada) → no bloquea (permite reintentar).

## 6. Disparo y UI

- **Botones no bloquean**: `ReportGenerateButton` (individual) y `TeamStudyCard` (equipo) → POST → 202 → toast *"Se está generando en segundo plano; puedes cerrar la página"* + estado "Generando…". El usuario puede navegar libremente.
- **Endpoint de estado**: `GET /api/reports/[id]/status` (auth + clínica) → `{ status, error? }`.
- **Componente de polling** (`GeneratingPanel` + hook): sondea cada ~4s mientras `generating`; al pasar a `draft` → `router.refresh()` + toast "Informe listo"; al pasar a `error` → muestra el motivo + **Reintentar**.
- **Surfaces**:
  - Pantalla de revisión (`/patients/[id]/report`, `/estudios/[id]/report`): si el último informe está `generating` → panel "Generando…"; `draft` → editor; `error` → fallo + reintentar.
  - Página de sesión (paso "Informe"): indicador gana el estado "Generando…".
  - `TeamStudyCard`: el bloque del informe muestra "Generando…" mientras corre.
- **Reintento**: lanza una generación nueva; como la revisión coge el informe **más reciente**, la nueva sustituye a la fallida.
- **Aviso**: in-app (toast si estás en una página que lo sondea; estado al volver si cerraste). Sin push/email v1.

## 7. Alcance y migración

- **Rutas**: `generate/route.ts` y `campaign-generate/route.ts` pasan al patrón (crear `generating` → 202 → `waitUntil(trabajo)` → `draft`/`error`).
- **Compartido**: helper de "ejecutar en segundo plano + actualizar estado" + candado de concurrencia; `GET /api/reports/[id]/status`; componente de polling.
- **Migración**: solo ampliar el CHECK de `status` (+ `error`). `maxDuration=800` en ambas rutas. Sin columnas nuevas.
- **Retrocompatibilidad**: `report_data` idéntico; informes existentes intactos. Las pantallas de revisión ya cogen el más reciente → solo se añade el manejo de `generating`/`error`.

## 8. Fases de implementación

- **G1** — Migración (CHECK `+error`) + helper compartido (segundo plano + candado + lectura de estado con detección de atascado).
- **G2** — Refactor `generate/route.ts` (individual) al patrón background + `maxDuration`.
- **G3** — Refactor `campaign-generate/route.ts` (equipo) al patrón background + `maxDuration`.
- **G4** — `GET /api/reports/[id]/status` + `GeneratingPanel`/hook de polling + integrarlo en las pantallas de revisión, la página de sesión y `TeamStudyCard`; botones no bloqueantes + toasts.
- **G5** — Error/reintento + detección de atascado + repaso de casos límite + build.
