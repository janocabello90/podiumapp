# Fase F — VALD por sesión + informe individual sobre la sesión (mini-plan)

> Doc de la Fase F. Antecede a la Fase G (informe agregado de campaña) y a la Fase H (alta masiva CSV).
> **Objetivo:** llevar los **documentos (VALD/imágenes)** y la **generación del informe individual** al nivel de **sesión** (Fase D), y **enriquecer el contexto de IA** con las **pruebas de la sesión** (`session_tests`: notas por prueba + `tests.vald_interpretation_prompt` por prueba) y los **documentos vinculados a esa sesión**.
> **Riesgo:** 🟡 medio — cambia el constructor de contexto IA y la subida de documentos. Todo **aditivo y retrocompatible**: `documents.session_id`/`session_test_id` NULLABLE; el generador sigue funcionando sin `sessionId` (ruta paciente actual) y con paciente **sin** VALD.

## Encaje con Campañas (Fase E)
- El informe de la Fase F es **individual, sobre una sesión** (`reports.session_id`), **da igual** si la sesión tiene `campaign_id` o no. Una sesión de campaña genera su informe individual **exactamente igual** que una suelta.
- La **agregación por campaña** (súper-informe) es la **Fase G**; NO se toca aquí. Aquí solo garantizamos que cada sesión de una campaña produzca un buen informe individual, que G luego agregará.

## Criterio de "completada"
Desde una **sesión** se suben PDFs de VALD e imágenes (quedan vinculados a esa sesión), y se **genera el informe** leyendo el contexto de **esa** sesión (anamnesis + exploración + notas por prueba + prompts VALD por prueba + documentos de la sesión). Revisión humana + PDF reutilizados. El flujo individual antiguo (generar desde la ficha, sin `sessionId`) sigue intacto. `npm run build` verde.

---

## Estado de partida (confirmado en código, 2026-07-29)
- `documents`: `patient_id NOT NULL`, `doc_type`, `storage_path`, `extracted_data` (JSONB; captions/notas de imágenes viven en `extracted_data.notes`). **No** tiene `session_id` ni `session_test_id`.
- Subida: `POST /api/documents` (multipart) con `patient_id` + `doc_type`; storage vía service_role; insert del registro con cliente RLS. `DocumentUploader` (PDFs), `ImageGallerySection` (imágenes, uploader propio inline).
- Informe: `POST /api/reports/generate` recibe **solo `patientId`**; elige la **última sesión** (`clinical_data`) con fallback a `assessments`; mete **todos** los `documents` del paciente + `patients.vald_interpretation`; **NO** usa `session_tests` ni `tests.vald_interpretation_prompt`. Ya guarda `reports.session_id` (Fase D).
- Página de sesión `/patients/[id]/sessions/[sessionId]`: pasos 1 anamnesis · 2 exploración · 3 pruebas (`SessionTestsPanel`) · **4 documentos e informe = placeholder** que remite a la ficha. ← Fase F lo hace real.
- `session_tests`: snapshot `test_name` + `notes` (por prueba). **A verificar en F3:** columna `test_id` para join con `tests.vald_interpretation_prompt` (si no existe, se usa solo `test_name` + notas).

---

## Tareas

### F1 — Migración + tipos
- `documents.session_id` NULLABLE → `sessions` **ON DELETE SET NULL**.
- `documents.session_test_id` NULLABLE → `session_tests` **ON DELETE SET NULL**.
- Índices parciales `documents(session_id)` y `documents(session_test_id)` where not null.
- (RLS de `documents` no cambia: sigue clínica-scoped; las nuevas columnas no abren nada.)
- `apply_migration` + archivo repo. Regenerar `database.generated.ts` + `database.ts` (`Document` recoge las columnas nuevas, nullable).
- **Aceptación:** columnas + FKs (`information_schema`), build OK.

### F2 — Documentos por sesión (subida + listado)
- `POST /api/documents`: aceptar `session_id` y `session_test_id` opcionales. Si viene `session_id`, **validar** que la sesión es del mismo `patient_id` + `clinic_id`; setear ambas columnas en el insert. Sin `session_id` → comportamiento actual intacto (documento a nivel paciente).
- Props opcionales `sessionId?: string` en `DocumentUploader`, `DocumentSection` e `ImageGallerySection` → se añaden a `formData` como `session_id`.
- Página de sesión **paso 4**: sustituir el placeholder por `DocumentSection` (PDFs VALD + interpretación) + `ImageGallerySection` (imágenes), **scoped a la sesión** (`initialDocuments` = documentos con `session_id = session.id`, divididos por `doc_type`).
- La ficha del paciente conserva sus secciones actuales (documentos a nivel paciente) sin cambios → retrocompatibilidad; la consolidación/retirada de la ficha queda como retoque cosmético posterior.
- **Aceptación:** subir un PDF y una imagen desde la sesión los deja con `session_id` (verificable en DB) y visibles en el paso 4; subir desde la ficha sigue creando documentos a nivel paciente.

### F3 — Constructor de contexto IA por sesión + generar desde la sesión
- `POST /api/reports/generate`: aceptar `sessionId` opcional (además de `patientId`).
  - Con `sessionId`: usar **esa** sesión (no la última); cargar sus `session_tests` (`test_name`, `notes`, y si existe `test_id` → join `tests.vald_interpretation_prompt`); cargar `documents` con `session_id = sessionId` (fallback a documentos del paciente sin `session_id` si la sesión no tiene ninguno). Añadir al contexto: **notas por prueba**, **prompts VALD por prueba**, y notas/captions de los documentos de la sesión. `reports.session_id = sessionId`.
  - Sin `sessionId`: comportamiento actual (última sesión + docs del paciente). Retrocompat.
  - Se mantiene `patients.vald_interpretation` como fuente adicional (no se rompe).
- `ReportGenerateButton`: prop opcional `sessionId` → se envía en el body.
- Página de sesión **paso 5** (o dentro del 4): botón "Generar informe" con `sessionId` + enlace a la revisión (`/patients/[id]/report`). Gating: exige exploración/sesión existente.
- **Aceptación:** una sesión con 2 pruebas (con notas) + un PDF VALD → el informe recibe notas y prompts por prueba; paciente **sin** VALD → informe se genera igual; build OK.

### F4 — QA + docs + commit
- Checklist QA. `CLAUDE.md` §17 (Fase F) + cerrar este doc. Commits Jano (código + docs), **sin push** hasta confirmación.

---

## Checklist de QA
1. **Regresión:** generar informe **desde la ficha** (sin `sessionId`) sigue funcionando igual (última sesión + docs del paciente + `vald_interpretation`).
2. Subir PDF VALD desde la **sesión** → queda con `session_id`; visible en el paso 4 de la sesión.
3. Subir imagen desde la sesión → `session_id` fijado; caption/incluir-en-informe funcionan.
4. Sesión con 2 pruebas + notas por prueba + prompts VALD → generar informe **desde la sesión**: las notas y prompts por prueba llegan al contexto; `reports.session_id` correcto.
5. Paciente **sin** VALD ni imágenes → el informe se genera igualmente.
6. Sesión de **campaña** → su informe individual se genera igual que una suelta (sin lógica especial de campaña; eso es Fase G).
7. RLS: otra clínica no ve documentos/sesiones ajenos. `npm run build` verde.

## Notas / riesgos
- Aditivo: `documents.session_id`/`session_test_id` NULLABLE; generador tolerante a sesiones sin VALD y a la ruta paciente sin `sessionId`.
- El **informe de campaña** (agregación IA) es **Fase G**, no aquí.
- La estructura del informe (`SYSTEM_PROMPT`), la revisión humana (`ReportEditor`) y el export PDF se **reutilizan** sin cambios.
- Posible duplicidad temporal de superficies de subida (ficha vs sesión) durante esta fase; se documenta y se consolida como cosmético posterior.

---

## Registro de ejecución
- **F1** — ✅ **HECHA (2026-07-29).** `documents.session_id` + `documents.session_test_id` NULLABLE (FK ON DELETE SET NULL) + índices parciales. Migración `20260729083709_link_documents_to_sessions` (verificado `information_schema`: ambas FK con `SET NULL`). Tipos regenerados (`Document` recoge las columnas). Confirmado `session_tests.test_id` existe → join a `tests.vald_interpretation_prompt` viable.
- **F2** — ✅ **HECHA (2026-07-29).** `POST /api/documents` acepta `session_id`/`session_test_id` (valida que la sesión es del paciente+clínica) y los setea en el insert. `DocumentUploader`/`DocumentSection`/`ImageGallerySection` con prop opcional `sessionId` → `formData`. Página de sesión: pasos **4 Informes VALD** + **5 Ecografías/fotografías** reales, scoped a la sesión (`documents.session_id = session.id`).
- **F3** — ✅ **HECHA (2026-07-29).** `POST /api/reports/generate` acepta `sessionId` opcional → usa esa sesión, carga `session_tests` (notas por prueba + `tests.vald_interpretation_prompt`) y documentos de la sesión (fallback a docs del paciente si la sesión no tiene). Bloque nuevo "PRUEBAS FÍSICAS DE LA SESIÓN" en el contexto IA. `ReportGenerateButton` con `sessionId`. Página de sesión **paso 6**: generar informe (sessionId) + enlace a revisión. Sin `sessionId` = comportamiento actual intacto.
- **F4** — ✅ **HECHA (2026-07-29).** `CLAUDE.md` §17 (Fase F). Build OK (33 páginas, "Compiled successfully"). Commits Jano.

**Fase F COMPLETADA.** Siguiente: Fase G (informe agregado de campaña) y Fase H (alta masiva CSV).
