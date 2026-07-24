# Migraciones legacy (superadas por el baseline)

Estos dos ficheros son las migraciones **originales**, que se aplicaron a mano
(SQL editor) sobre la DB de producción **fuera** del sistema de migraciones de
Supabase. Nunca estuvieron registradas en `supabase_migrations.schema_migrations`.

- `001_initial_schema.sql` — tablas, RLS, seed de la clínica.
- `002_patient_classification.sql` — columnas de clasificación en `patients`.

## Por qué están aquí y no en la carpeta activa

En la Fase 0 (Tarea 2) se creó un **baseline** que captura el estado REAL actual
de la DB (incluyendo drift que estas dos no reflejaban: `rls_auto_enable`, event
trigger `ensure_rls`, buckets de storage, y la eliminación de la policy pública
de UPDATE en `anamnesis_forms`):

- `../20260101000000_baseline_remote_schema.sql`  ← migración inicial canónica
- `../20260723074241_drop_public_anamnesis_update_policy.sql`  ← Fase 0 Tarea 1

El baseline **contiene todo lo que hacían 001 + 002**. Por eso estas se retiran de
la carpeta activa: se conservan aquí **solo como referencia histórica**. NO deben
re-ejecutarse (fallarían sobre tablas ya existentes) ni forman parte de la
secuencia de migraciones a aplicar.

## Estado en el historial remoto (`supabase_migrations.schema_migrations`)

- `20260101000000_baseline_remote_schema` → marcada como aplicada (no se ejecutó
  contra la DB existente; describe el estado ya presente).
- `20260723074241_drop_public_anamnesis_update_policy` → aplicada de verdad vía MCP.

De ahora en adelante, **toda** modificación de esquema/policy/bucket se hace como
migración versionada (vía el MCP `supabase-sherpa` `apply_migration`, que además
la registra en el historial), y `types/database.generated.ts` se regenera.
