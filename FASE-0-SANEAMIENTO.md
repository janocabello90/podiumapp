# SHERPA — Priorización técnica y propuesta de Fase 0

> Documento de decisión previo al flujo de grupos/equipos (Prompt 2).
> Basado en `CLAUDE.md` (auditoría de código + validación contra la DB real `njzqyttrlivipnkwmbbt` vía MCP read-only, 2026-07).
> **No implementa nada.** Solo prioriza y secuencia.

---

## 1. Resumen ejecutivo

**Veredicto: SÍ hace falta una Fase 0 de saneamiento, pero es corta y acotada — no es un refactor grande.**

El flujo individual funciona y la arquitectura es razonable para lo que hace. **No hay que rehacer nada.** Pero hay **tres cosas que sí bloquean crecer con tranquilidad** y una cuarta que es un bug activo barato de arreglar:

1. Una **fuga de PII clínica** real (SELECT abierto en `anamnesis_forms`).
2. Un **agujero de escritura muerto** (UPDATE abierto) que se cierra en 1 minuto.
3. El **sistema de migraciones no está en uso** (historial vacío + drift). Añadir tablas de equipos encima de eso multiplicaría el desorden.
4. Un **bug de pérdida silenciosa de datos** (`vald_interpretation`) que además sirve como "primera migración de prueba".

**Matiz importante de secuenciación:** la Fase 0 solo bloquea la **implementación** del nuevo flujo, no su **diseño**. Se puede (y conviene) **diseñar** el modelado de grupos/equipos/sesiones en paralelo, porque el diseño no toca producción. Es decir: **Fase 0 de saneamiento + diseño funcional del Prompt 2 pueden ir a la vez; lo que no debe empezar hasta cerrar Fase 0 es crear tablas nuevas en la DB.**

Esfuerzo estimado de Fase 0: **pequeño** (días, no semanas). Es sobre todo seguridad + poner en marcha migraciones, no reescritura.

---

## 2. Clasificación de problemas por prioridad

### 🔴 P0 — crítico, corregir antes de cualquier ampliación

**P0.1 — `anamnesis_forms` SELECT `USING(TRUE)` (fuga de PII)**
- **Descripción:** policy pública de SELECT sin restricción. La anon key es pública (va en el bundle JS).
- **Impacto real:** cualquiera con la anon key puede leer **todas** las anamnesis de **todas** las clínicas (datos clínicos + consentimientos + `patient_id`), sin necesidad del token.
- **Riesgo si no se corrige:** brecha de datos personales de salud (LOPD/GDPR) en una app clínica. Empeora al escalar (más clínicas, más pacientes, más superficie).
- **Por qué P0:** es el riesgo más grave y es de datos sensibles de salud. El linter de Supabase **no** lo marca (excluye los SELECT públicos por diseño), así que es fácil de pasar por alto.
- **Ojo (dependencia):** es *load-bearing* — la página pública `/anamnesis/[token]` depende de esta policy para leer. **Hay que migrar primero la lectura** a un endpoint server-side con service_role que valide el token, y **luego** borrar la policy. No se puede borrar en seco.

**P0.2 — `anamnesis_forms` UPDATE `USING(TRUE)` (escritura abierta, código muerto)**
- **Descripción:** policy pública de UPDATE sin restricción.
- **Impacto real:** cualquiera con la anon key puede **modificar** cualquier anamnesis de cualquier clínica.
- **Riesgo si no se corrige:** manipulación/borrado de datos clínicos por terceros.
- **Por qué P0:** agujero activo de escritura. **Y además es gratis cerrarlo:** las escrituras del paciente ya van por `PATCH /api/anamnesis/[token]` (service_role, valida token) desde el refactor `baa8b06`. Esta policy **no la usa nada** → se puede borrar de inmediato, sin dependencias, sin impacto funcional. Es la victoria más rápida de todo el documento.

**P0.3 — Sistema de migraciones sin usar + drift repo↔DB (bloqueo estructural para crecer)**
- **Descripción:** el historial de migraciones de Supabase está **vacío**; los `.sql` del repo se aplicaron a mano. El repo no refleja la DB real (`vald_interpretation` ausente, `rls_auto_enable` presente, buckets fuera de migración).
- **Impacto real:** no hay fuente de verdad ni reproducibilidad. Cada cambio es manual y no versionado.
- **Riesgo si no se corrige:** meter `groups/teams/sports/tests/sessions` a mano encima de esto multiplica el drift y hace el nuevo flujo frágil e irreproducible.
- **Por qué P0:** es un **bloqueo específico del nuevo flujo**. No amenaza la seguridad de hoy, pero sí impide crecer de forma sana. Debe quedar reconciliado **antes** de crear la primera tabla nueva.

### 🟠 P1 — muy recomendable corregir antes o al inicio del nuevo trabajo

**P1.1 — Bug `patients.vald_interpretation` (pérdida silenciosa de datos)**
- **Descripción:** la columna no existe en la DB; el `update` falla y el error se traga; la lectura devuelve `undefined`; el informe IA nunca recibe ese texto. El campo **es visible y usable en la UI**.
- **Impacto real:** el fisio teclea la interpretación VALD creyendo que se guarda; se pierde y no llega al informe.
- **Riesgo si no se corrige:** pérdida de datos clínicos y desconfianza en la herramienta.
- **Por qué P1 (incluido en Fase 0):** no bloquea el nuevo flujo, pero es un bug real de cara al usuario y **es barato**. Ideal como **primera migración de verdad** una vez montado P0.3 (valida el nuevo workflow).
- **DECISIÓN (2026-07): se RECUPERA la feature.** Se creará la columna `patients.vald_interpretation TEXT` vía migración versionada (será la primera migración de negocio sobre el nuevo baseline). No se elimina el campo de la UI. Tras crearla, verificar end-to-end: guardar desde `DocumentSection` → releer en la ficha → que llegue al contexto del informe en `reports/generate`.

**P1.2 — Orden no determinista `assessments?.[0]` / `reports?.[0]`**
- **Descripción:** varios sitios cogen el primer registro sin ordenar, asumiendo orden de inserción; otros sí ordenan por fecha.
- **Impacto real:** hoy casi inocuo (1 valoración por paciente).
- **Riesgo si no se corrige:** **el nuevo flujo introduce múltiples sesiones por paciente** → esto pasará a mostrar el registro equivocado. Es un bug latente que el flujo de equipos **va a activar**.
- **Por qué P1:** no urge hoy, pero hay que arreglarlo **al tocar esa zona** al construir sesiones. Tenerlo fichado evita un bug sutil.

**P1.3 — `types/database.ts` a mano y desincronizado**
- **Descripción:** tipos TS mantenidos manualmente, ya sin `vald_interpretation` ni columnas de `002` completas.
- **Impacto real:** falsa sensación de seguridad de tipos.
- **Por qué P1:** se resuelve casi gratis **junto con P0.3** (generar tipos desde Supabase tras el baseline). Hacerlo en el mismo momento.

### 🟡 P2 — puede convivir temporalmente con el nuevo desarrollo

- **P2.1 — Defensa en profundidad:** páginas server (`patients/[id]`) que cargan sin filtrar `clinic_id`, confiando solo en RLS. Endurecer, sobre todo al añadir la capa de equipos (más superficies de aislamiento). No bloquea.
- **P2.2 — Hardening de advisors:** fijar `search_path` en `get_user_clinic_id`/`update_updated_at`; `REVOKE EXECUTE` de funciones SECURITY DEFINER; **activar protección de contraseñas filtradas** (esto último es 1 clic en Auth → hacerlo ya, gratis). Ninguno es ERROR.
- **P2.3 — `doc_type` sin validar:** cualquier PDF entra como `vald_report` (en prod hay un "Justificante de Pago.pdf"). Cosmético/robustez.
- **P2.4 — `/api/admin/reset-patients`:** borrado masivo destructivo; admin-only y clínica-scoped, pero de alto impacto. Revisar cuando haya más datos.
- **P2.5 — Cliente admin duplicado:** unificar `createClient(url, serviceRoleKey)` inline con `lib/supabase/admin.ts`.

### 🔵 P3 — mejora futura / deuda no bloqueante

- **P3.1 — JSONB para todo** (`form_data`, `assessment_data`, `report_data`) sin validación de esquema. Flexible; migrar a estructura es un proyecto en sí. No tocar aún.
- **P3.2 — Parseo frágil del JSON del LLM** (regex). Mejor salida estructurada (tool use / JSON mode). Deseable, no urgente.
- **P3.3 — Modelos IA hardcodeados** por ruta → externalizar a config.
- **P3.4 — Fire-and-forget con reenvío de cookie** (`reports/generate`→`classify`): acoplamiento frágil. **Confirmado (2026-07):** en Vercel, si la función se congela/mata tras responder, el `fetch` sin `await` puede quedarse a medias y **no nos enteramos** (sin reintento ni log fiable). **Por qué sigue siendo P3:** lo único que se pierde es la **autoclasificación** (no-crítica) y hay **fallback manual** (banner "Clasificar con IA" + backfill + override). Impacto real bajo hoy.
  - **Fix recomendado cuando toque:** sustituir el `fetch` suelto por `waitUntil` (`@vercel/functions`) / `unstable_after` de Next 14 — el primitivo pensado para "ejecutar tras responder sin que maten la función". Cambio pequeño, no requiere cola.
  - **⚠️ Guardarraíl para el Prompt 2:** NO reutilizar este patrón para nada que deba persistir sí o sí (p. ej. informe agregado de equipo). Datos críticos → en la misma request, `waitUntil`, o cola real.
- **P3.5 — README genérico** de create-next-app (suplido por `CLAUDE.md`).

### ⚪ Informativo — conocer, no "arreglar"

- **Event trigger `ensure_rls` / `rls_auto_enable()`:** activa RLS automáticamente en toda tabla nueva de `public`, pero **no crea policies**. Al crear las tablas del flujo de equipos nacerán con RLS ON y **deny-all** hasta que se añadan policies explícitas. No es un fallo; es un comportamiento a recordar.

### 🚫 No es saneamiento — es diseño del Prompt 2 (no confundir)

- **Ausencia de entidad "sesión"** de primera clase, modelado de `groups/teams/sports/tests`, reorganización de navegación y **colisión de nombres "Equipo" (staff) vs "Equipos" (deportivos)**. Esto **no** va en Fase 0: es el propio diseño del nuevo flujo. Se diseña en el Prompt 2.

---

## 3. Dependencias y orden recomendado

Secuencia razonada (no solo lista):

1. **P0.2 primero (drop UPDATE policy muerta).** Sin dependencias, 1 minuto, cierra medio agujero. Da una victoria inmediata y reduce riesgo ya.
2. **P0.3 baseline de migraciones.** Es prerequisito de casi todo lo demás: para tocar la DB con garantías (crear columna de P1.1, endpoint/policy de P0.1, tablas nuevas del Prompt 2) necesitas el sistema de migraciones funcionando y el repo reconciliado con la DB. Incluye capturar el estado real (`supabase db pull`), marcar 001/002 como aplicadas, e integrar `rls_auto_enable`/buckets en el repo.
3. **P1.3 generar tipos** inmediatamente después del baseline (mismo bloque de trabajo).
4. **P0.1 cerrar el SELECT abierto**, en dos pasos y **ya sobre migraciones**: (a) nuevo endpoint server-side que lee la anamnesis por token con service_role, (b) cambiar la página pública a ese endpoint, (c) **migración** que borra la policy `SELECT USING(TRUE)`. Va después del baseline porque el borrado de la policy debe ser una migración versionada.
5. **P1.1 decidir y arreglar `vald_interpretation`** como **primera migración de negocio** (crear columna) o quitar el campo de UI. Sirve de validación end-to-end del nuevo workflow de migraciones.
6. **P2.2 activar leaked-password protection** (1 clic, cuando toques Auth/settings).

A partir de aquí, SHERPA está en estado seguro y ampliable → **luz verde para implementar el Prompt 2.**

P1.2 (orden no determinista) y el resto de P2 se abordan **dentro** del trabajo del Prompt 2, al tocar sus zonas.

---

## 4. Fase 0 propuesta (solo lo imprescindible)

**Objetivo:** dejar SHERPA seguro y ampliable, sin abrir frentes de más.

| # | Tarea | Prioridad | Nota |
|---|-------|-----------|------|
| 1 | ✅ **HECHO (2026-07)** — Borrar policy `Public can update anamnesis by token` (UPDATE) | P0.2 | Aplicado en prod vía `apply_migration` (`20260723074241_drop_public_anamnesis_update_policy`). Verificado: 5→4 policies. Archivo repo: `supabase/migrations/003_drop_public_anamnesis_update_policy.sql` (⚠️ sin commitear aún) |
| 2 | ✅ **HECHO (2026-07)** — Baseline de migraciones: reconciliar repo↔DB, marcar 001/002 aplicadas, incluir `rls_auto_enable`/buckets | P0.3 | Baseline `20260101000000_baseline_remote_schema.sql` (introspección vía MCP) reflejando estado real. 001/002 → `_legacy/`. Historial remoto reparado: `[baseline, drop]`. `apply_migration` es el flujo de aquí en adelante |
| 3 | ✅ **HECHO (2026-07)** — Generar `types/database.ts` desde Supabase | P1.3 | `types/database.generated.ts` autogenerado (fuente de verdad) + `types/database.ts` deriva de él (solo overrides no-nulos/enum a mano). Build OK |
| 4 | ✅ **HECHO (2026-07)** — Migrar lectura de anamnesis pública a service_role + borrar policy `SELECT USING(TRUE)` | P0.1 | Helper `src/lib/anamnesis/getByToken.ts` (service_role) + página consume el helper (desplegado). Policy borrada vía migración `20260724000000_drop_public_anamnesis_select_policy`. Verificado: anon 2→0, página pública OK |
| 5 | ✅ **HECHO (2026-07)** — Recuperar `vald_interpretation` (crear columna) | P1.1 | `patients.vald_interpretation TEXT` vía `apply_migration` (`20260724163050`). Tipos regenerados. `DocumentSection` ya no traga el error (toast visible). Feature funciona en prod (el código desplegado ya la usa). Build OK |
| 6 | Activar protección de contraseñas filtradas en Auth | P2.2 | 1 clic, gratis |

**Fuera de Fase 0** (aunque tienten): todo P2 restante y todo P3. No entran.

**Criterio de "Fase 0 terminada":** sin policies `USING(TRUE)` peligrosas, migraciones versionadas y aplicables, tipos generados, y ningún campo de UI que pierda datos en silencio.

---

## 5. Qué NO tocar todavía

Para no dispersar esfuerzo ni retrasar el proyecto:

- **JSONB → esquemas estructurados (P3.1).** Es un proyecto grande; el nuevo flujo puede convivir con JSONB. No abrir ahora.
- **Parseo del LLM / tool use / modelos en config (P3.2–P3.3).** Funciona; mejorar es deseable, no urgente. Además `reports=0` en prod sugiere que el flujo de informe apenas se ha ejercido: no es el cuello de botella hoy.
- **Reescribir el fire-and-forget de clasificación (P3.4).** Acoplamiento feo pero funcional.
- **Refactor de defensa en profundidad masivo (P2.1) como tarea aparte.** Hacerlo *incrementalmente* al tocar cada página en el Prompt 2, no como barrido previo.
- **La entidad "sesión" y el modelado de equipos.** No es saneamiento: es el diseño del Prompt 2. No adelantar implementación; sí se puede diseñar en paralelo.
- **Endpoint `reset-patients` (P2.4)** y unificación del cliente admin (P2.5): esperar.

---

## TL;DR

- **¿Fase 0 antes del Prompt 2?** Sí, pero **corta**: seguridad de anamnesis (P0.1, P0.2) + migraciones (P0.3) + tipos (P1.3) + bug VALD (P1.1) + toggle de Auth. Nada más.
- **¿Se puede avanzar ya en algo del Prompt 2?** Sí: **el diseño** funcional (modelado, navegación, sesión) se puede hacer en paralelo. Lo que espera a cerrar Fase 0 es **crear tablas nuevas en la DB**.
- **¿Hay que rehacer la app?** No. El flujo individual se conserva tal cual.
