# Fase H — Alta masiva CSV de jugadores (mini-plan)

> Doc de la Fase H. **Última fase del flujo de equipos.** Permite dar de alta muchos jugadores de un equipo de golpe desde un CSV, con previsualización, validación y detección de duplicados.
> **Riesgo:** 🟡 bajo-medio — **sin migración** (usa `patients`); reutiliza el alta existente (insert autenticado con RLS clínica-scoped). El riesgo está en el parseo/validación (casos límite del CSV), no en el modelo.
> **Criterio de "completada":** desde `/teams/[id]` se sube un CSV, se previsualizan las filas con validación por fila y aviso de duplicados, y al confirmar se crean en lote los `patients` con `team_id` fijado; filas inválidas marcadas y no creadas; duplicados no recreados. `npm run build` verde.

## Estado de partida (confirmado en código)
- Alta individual: `/patients/new` (cliente) hace `supabase.from('patients').insert({ clinic_id, created_by, team_id, full_name, email, phone, date_of_birth, gender, notes })` con el cliente autenticado (RLS). Solo `full_name` es obligatorio; el resto nullable.
- El roster vive en `/teams/[id]`; "Añadir jugador" enlaza a `/patients/new?team_id=`.
- No hay librería de CSV/Excel en el proyecto (sin `papaparse`, sin `xlsx`).

---

## Decisiones (confirmadas 2026-07-29)
1. **Formatos → CSV + XLSX.** Se soportan ambos. `.xlsx` requiere añadir la dependencia `xlsx` (SheetJS); se lee la primera hoja y se trata como tabla igual que el CSV.
2. **Duplicado → por EMAIL dentro del equipo.** Se marca duplicado si el email ya existe entre los jugadores **de ese equipo** (o se repite dentro del fichero). El **mismo email en otro equipo NO es duplicado** (ver nota de modelo abajo). Filas sin email no se comprueban por email (se puede avisar por nombre como secundario, informativo). Duplicados **excluidos por defecto**.
3. **Campos → todos los del alta individual** (`full_name`, `email`, `phone`, `date_of_birth`, `gender`, `notes`). **Obligatorio solo `full_name`** (igual que el registro individual); el resto opcional pero se importa y valida si viene.
4. **UI → en la página del equipo** (`/teams/[id]`).

> **Nota de modelo (importante) — ¿un jugador en dos equipos?** Hoy `patients.team_id` es un **único** FK: un registro de paciente pertenece a **un solo equipo**. Por eso "duplicado por email en el equipo" es coherente: el **mismo email puede existir en otro equipo**, pero sería **otro registro de paciente** (una ficha por equipo), no la misma entidad compartida. Si se quisiera que **una misma persona** esté en **varios equipos como un único registro**, haría falta un cambio de modelo (tabla N:M `patient_teams`), que **queda fuera de la Fase H**. v1 asume: una ficha por (persona, equipo).

## Alcance v1
- **CSV (`.csv`) y Excel (`.xlsx`)**. CSV: parser propio (comillas dobles, comas entrecomilladas, `;` fallback de Excel-ES). XLSX: vía `xlsx` (SheetJS), primera hoja → matriz de celdas → mismo pipeline de mapeo/validación.
- Columnas reconocidas (cabeceras flexibles, alias ES/EN; case-insensitive, sin tildes):
  - `nombre` / `full_name` / `nombre completo` → **full_name (obligatorio)**
  - `email` / `correo` → email
  - `telefono` / `teléfono` / `phone` / `movil` → phone
  - `fecha_nacimiento` / `nacimiento` / `date_of_birth` / `fecha de nacimiento` → date_of_birth (acepta `dd/mm/aaaa` y `aaaa-mm-dd`)
  - `sexo` / `genero` / `género` / `gender` → gender (normaliza hombre/mujer/m/f/masculino/femenino → `male`/`female`)
- **Plantilla descargable** (CSV de ejemplo con las cabeceras correctas) para evitar errores de formato.

---

## Tareas

### H1 — Parser (CSV+XLSX) + validación + plantilla (util puro)
- Añadir dependencia `xlsx` (SheetJS). `npm install xlsx`.
- `src/lib/patients/rosterImport.ts`: funciones puras
  - `parseCsv(text): string[][]` (comillas, comas, `;` fallback).
  - `parseXlsx(arrayBuffer): string[][]` (primera hoja → matriz, vía `xlsx`).
  - `mapHeaders(headerRow): { field, index }[]` (alias ES/EN, normalizando tildes/case).
  - `validateRow(raw): { data: NewPatientDraft, errors: string[] }` (obligatorio full_name; email con regex simple; fecha `dd/mm/aaaa`|`aaaa-mm-dd` → ISO; gender normalizado; phone/notes opcionales).
  - `buildTemplateCsv(): string` (CSV de ejemplo con todas las cabeceras).
- **Aceptación:** parseo correcto de CSV (comas entrecomilladas, `;`) y XLSX; fecha en dos formatos; género en varias formas.

### H2 — UI de importación en `/teams/[id]`
- Componente cliente `BulkImportPlayers` (colapsable/modal) en `/teams/[id]` (recibe los jugadores actuales del equipo para el chequeo de duplicados):
  - Botón "Importar CSV/Excel" + input file (`accept=".csv,.xlsx"`) + enlace "Descargar plantilla".
  - Al cargar → parsear (según extensión) + mapear + validar → **tabla de previsualización**: por fila, columnas mapeadas + estado (✅ válida / ⚠️ duplicada / ❌ error con motivo).
  - **Duplicados por email** contra los jugadores **de este equipo** y dentro del propio fichero. Excluidos por defecto (toggle "importar igualmente").
  - Resumen: "N válidas, M duplicadas, K con error".
- **Aceptación:** subir un fichero de 10 filas (una inválida, una duplicada por email) → preview con los estados correctos.

### H3 — Creación en lote
- Al confirmar: insertar las filas válidas (no duplicadas, o forzadas) con `supabase.from('patients').insert([...])` — o en bucle con manejo por fila — fijando `clinic_id`, `created_by`, `team_id`, `status='active'`.
- Manejo de errores **por fila** (si una falla, seguir con el resto; reportar cuáles fallaron). Toast de resumen. `router.refresh()` para actualizar el roster.
- **Aceptación:** 10 jugadores → creados con el `team_id` correcto; fila inválida no creada; duplicado no recreado; el roster se actualiza.

### H4 — QA + docs + commit
- Checklist QA. `CLAUDE.md` §17 (Fase H) + cerrar este doc. Commits Jano (sin push hasta confirmación).

---

## Navegación
- Todo dentro de `/teams/[id]` (ya protegida). Sin rutas nuevas ni migración.

## Checklist de QA
1. Descargar plantilla → rellenar → importar: todas válidas → creadas con `team_id` correcto.
2. Fila sin nombre → marcada ❌ y no creada.
3. Email mal formado → ⚠️/❌ según criterio; fecha en `dd/mm/aaaa` y `aaaa-mm-dd` → ambas parseadas.
4. Jugador ya existente en el equipo (mismo nombre) → marcado duplicado y excluido por defecto.
5. Duplicado dentro del propio CSV (dos filas iguales) → solo una candidata.
6. CSV con `;` como separador (Excel-ES) → parseado igualmente.
7. **Regresión:** alta individual (`/patients/new`) sigue funcionando igual. `npm run build` verde.
8. RLS: no se pueden crear jugadores en un equipo de otra clínica (el insert va con el cliente autenticado + clinic_id propio).

## Notas / riesgos
- **Sin migración** (usa `patients`). Reutiliza el patrón de alta individual.
- Parser propio: cubrir comillas y separador `;`; documentar limitaciones (no soporta CSV exóticos ni `.xlsx`).
- Inserción en lote: preferible tolerante a fallos por fila (no abortar todo por una fila mala).
- Sin envío de anamnesis automático (sigue siendo manual, fuera de alcance). El intake delegado por enlace es un pospuesto de diseño (ver PLAN §"Pospuesto").

---

## Registro de ejecución
- **H1** — ✅ **HECHA (2026-07-29).** Dependencia `xlsx@0.18.5`. `src/lib/patients/rosterImport.ts` (util puro): `parseCsv` (comillas, `;` fallback, BOM), `parseXlsx` (async, **import dinámico** de `xlsx` para no inflar el bundle), `mapHeaders` (alias ES/EN, sin tildes/case), `validateRow` (full_name obligatorio; email regex; fecha `dd/mm/aaaa`|`aaaa-mm-dd`→ISO; gender normalizado; phone/notes opc.), `tableToRows`, `buildTemplateCsv`.
- **H2** — ✅ **HECHA (2026-07-29).** `components/teams/BulkImportPlayers.tsx` (cliente, modal) en `/teams/[id]`: elegir fichero (`.csv,.xlsx`) + descargar plantilla + **previsualización** con estado por fila (✅ válida / ⚠️ duplicada / ❌ error + motivo), resumen de conteos, y toggle de inclusión por fila. **Duplicados por email** contra los jugadores del equipo (`existingEmails` normalizados, pasados desde la página) y dentro del propio fichero; excluidos por defecto.
- **H3** — ✅ **HECHA (2026-07-29).** Importación en lote: `supabase.from('patients').insert([...])` con `clinic_id`/`created_by`/`team_id`/`status='active'` (RLS clínica-scoped) → toast de resumen + `router.refresh()`. La página del equipo trae ahora `email` en el roster y calcula `existingEmails`.
- **H4** — ✅ **HECHA (2026-07-29).** `CLAUDE.md` §17 (Fase H). Build OK (`/teams/[id]` 162 kB tras code-split de `xlsx`; "Compiled successfully"). Commits Jano.

**Fase H COMPLETADA.** Con esto se cierra el flujo de equipos A–H (el caso individual intacto en todas).
