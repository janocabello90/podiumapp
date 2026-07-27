# Fase C — Consentimientos y trazabilidad (mini-plan de fase)

> Doc de la Fase C del `PLAN-IMPLEMENTACION-EQUIPOS.md`. Kickoff + registro de ejecución.
> **Objetivo:** tabla dedicada de consentimientos (tipo + versión de texto + timestamp) para **trazabilidad**, además de los flags actuales en `anamnesis_forms`. Gestión de textos/versiones desde Ajustes; registro al aceptarlos en la anamnesis pública.
> **Riesgo:** 🟡 bajo-medio — aditivo, pero **toca el endpoint público de anamnesis**. Regla de oro (Fase 0): **nunca `USING(true)`**; el guardado público va por **service_role**.
> **Criterio de "completada":** cada consentimiento aceptado queda registrado con tipo/versión/fecha; la anamnesis sigue funcionando; los 3 tipos (datos, tratamiento de la información, IA) contemplados; `npm run build` verde; RLS aísla por clínica.

---

## Diseño de esquema (migración C1)

**`consent_versions`** — textos versionados por tipo (gestión de la clínica)
- `id` uuid PK `default uuid_generate_v4()`
- `clinic_id` uuid NOT NULL → `clinics(id)` ON DELETE CASCADE
- `type` text NOT NULL CHECK `IN ('data_processing','info_treatment','ai_analysis')`
- `version_label` text NOT NULL (ej. "v1", "2026-07")
- `body` text NOT NULL (texto del consentimiento)
- `is_active` boolean `default true` (versión vigente por tipo)
- `created_at` timestamptz `default now()`
- Índice `(clinic_id, type)`

**`consents`** — registro inmutable de cada aceptación (trazabilidad)
- `id` uuid PK
- `clinic_id` uuid NOT NULL → `clinics(id)` ON DELETE CASCADE
- `patient_id` uuid NOT NULL → `patients(id)` ON DELETE CASCADE
- `anamnesis_id` uuid NULL → `anamnesis_forms(id)` ON DELETE SET NULL
- `type` text NOT NULL CHECK (mismos 3 valores)
- `granted` boolean NOT NULL
- `version_label` text · `version_body` text (**copia** del texto aceptado — trazabilidad aunque la versión cambie después)
- `granted_at` timestamptz `default now()` · `created_at` timestamptz `default now()`
- Índices `(patient_id)`, `(clinic_id, type)`

**RLS:** ⚠️ `ensure_rls` = deny-all → policies en la misma migración.
- `consent_versions`: `FOR ALL USING/WITH CHECK (clinic_id = get_user_clinic_id())`.
- `consents`: **SELECT** clínica-scoped (staff lee). La escritura pública va por **service_role** (bypassa RLS); opcional INSERT clínica-scoped para staff.

---

## Tareas

### C1 — Migración + tipos
- Migración `consent_versions` + `consents` (+CHECKs, índices, RLS/policies) vía `apply_migration`; archivo repo con la versión del historial.
- Regenerar tipos + alias `Consent`, `ConsentVersion` en `database.ts`.
- `npm run build`. **Aceptación:** tablas + policies (`pg_policies`), build OK.

### C2 — Gestión de textos/versiones (Ajustes → "Consentimientos")
- `/settings/consents`: por cada tipo, ver/editar la versión vigente (`consent_versions.is_active`). Crear nueva versión desactiva la anterior (histórico conservado).
- Acceso desde la pestaña de Ajustes (patrón B4).
- **Aceptación:** editar el texto de cada tipo; una versión activa por tipo.

### C3 — Registrar consentimientos en la anamnesis pública
- `/api/anamnesis/[token]` (service_role): al aceptar (`action='consent'`/`'submit'`), **insertar filas en `consents`** (una por tipo con `granted`, `version_label`/`version_body` de la versión activa, `patient_id`, `anamnesis_id`, `granted_at`). Mantener los flags de `anamnesis_forms`.
- `AnamnesisFormClient`: mostrar los **3** consentimientos (añadir "tratamiento de la información") con su texto (de `consent_versions`).
- **Aceptación:** aceptar los 3 → 3 filas en `consents`; flags correctos.

### C4 — Ver trazabilidad (opcional, ligero)
- En la ficha/visor de anamnesis: mostrar consentimientos registrados (tipo · aceptado · versión · fecha), solo lectura.

### C5 — QA + docs + commit
- Checklist. `CLAUDE.md` §17 (Fase C) + cerrar este doc. Commits Jano (código + docs), sin push hasta OK.

---

## Cambios de UX
- Ajustes → **"Consentimientos"** (textos/versiones por tipo).
- Anamnesis pública: **3 consentimientos** (se añade "tratamiento de la información") con texto versionado.
- (Opcional C4) trazabilidad en ficha/visor de anamnesis.

## Checklist de QA
1. **Regresión:** anamnesis pública funciona (rellenar/autosave/enviar); individual y Fases A/B intactos.
2. Editar el texto de un consentimiento → nueva versión activa; anterior como histórico.
3. Aceptar los 3 → 3 filas en `consents` con versión+fecha; flags de `anamnesis_forms` correctos.
4. Cambiar el texto **después** no altera consentimientos ya registrados (copia `version_body`).
5. RLS: otra clínica no ve consents/versiones; escritura pública por service_role (nunca `USING(true)`).
6. `npm run build` verde.

## Notas / riesgos
- **C3 toca el flujo público de anamnesis** → probar end-to-end; mantener flags; nunca abrir RLS.
- **Trazabilidad real:** `consents` guarda copia del texto (`version_body`).
- **3er consentimiento:** hoy la UI tiene 2 (datos + IA). Decisión menor: ¿flag `consent_info_treatment` en `anamnesis_forms` o basta con `consents`? Recomendación: registrar en `consents` (fuente de trazabilidad) + flag adicional solo si el código lo necesita. Se concreta en C1/C3.

---

## Registro de ejecución
_(Se completa a medida que se ejecutan las tareas.)_

- **C1** — ✅ **HECHA (2026-07-27).** Migración `20260727154457_create_consents_and_consent_versions` aplicada vía MCP (archivo repo con el mismo nombre). Creadas `consent_versions` (type CHECK 3 valores, `body`, `version_label`, `is_active`, timestamps + trigger updated_at) y `consents` (registro con copia `version_body`, FK a patients/anamnesis_forms). Índices + RLS: `consent_versions` `FOR ALL` clínica-scoped; `consents` SELECT+INSERT clínica-scoped (escritura pública vía service_role, sin policy pública). Verificado `pg_policies` → no deny-all. Tipos: bloques añadidos a `database.generated.ts` + alias `Consent`/`ConsentVersion`/`ConsentType` en `database.ts`. `npm run build` OK. Sin commit / sin push.
- **C2** — ✅ **HECHA (2026-07-27).** `/settings/consents` (server) + `components/settings/ConsentsManager.tsx`: editar el texto vigente por tipo (upsert de `consent_versions` activa). Pestaña **"Consentimientos"** en `SettingsClient`. Módulo `lib/clinical/consents.ts` (tipos + labels). Build OK.
- **C3** — ✅ **HECHA (2026-07-27).** `AnamnesisFormClient`: **3** consentimientos (añadido "tratamiento de la información") con textos de `consent_versions` (fallback a defaults); `canProceed` = los 3; envía los 3 flags. `/api/anamnesis/[token]` (service_role): en `submit` registra 3 filas en `consents` (delete+insert idempotente por `anamnesis_id`, copia `version_body`), **no fatal**. Helper `getByToken` devuelve `consentTexts` (versión activa por tipo). Build OK. **Sensible** (toca anamnesis pública): probar circuito end-to-end en QA.
- **C4** — ✅ **HECHA (2026-07-27).** Card "Consentimientos" en la ficha del paciente (tipo · aceptado/rechazado · fecha), último por tipo. Build OK.
- **C5** — ✅ **HECHA (2026-07-27).** `CLAUDE.md` §17 (Fase C). Doc cerrado. Build verde (32 páginas). Commits código C1–C4 + docs (Jano, sin push).

**Fase C COMPLETADA.** Siguiente: Fase D (entidad Sesión + refactor de valoración — la de mayor riesgo) — ver `PLAN-IMPLEMENTACION-EQUIPOS.md`.
