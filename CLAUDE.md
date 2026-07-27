# CLAUDE.md — SHERPA (repo `podium-app`)

> Memoria técnica de onboarding para agentes/desarrolladores que trabajen en este repo.
> **Fase actual:** auditoría y documentación. NO se está implementando el flujo nuevo de equipos todavía.
>
> **Convención de nombres:** el producto se llama **SHERPA** (Systematic Health Evaluation Roadmap Patient Assistant).
> El código, el `package.json` (`podium-app`), la UI ("Podium", "Clínica Podium") y la marca del informe ("Método Podium™") todavía usan **Podium**. Trátalos como el mismo producto; SHERPA es el nombre nuevo de cara a documentación y trabajo futuro.

Cada afirmación va etiquetada:
- **[C]** confirmado por código de este repo.
- **[I]** inferido (lógica/convención, sin poder ejecutarlo end-to-end).
- **[V]** pendiente de validar (requiere credenciales, DB de producción o decisión de negocio).

---

## 1. Propósito del proyecto

**[C]** Aplicación interna para una clínica de fisioterapia. Gestiona el ciclo de valoración clínica de **pacientes individuales**:

registro de paciente → anamnesis previa (rellenada por el paciente desde casa vía enlace) → valoración/exploración del fisio (con dictado por voz) → subida de PDFs de VALD e imágenes clínicas → generación de **informe asistido por IA** → revisión humana → aprobación y exportación a PDF.

**[C]** Multi-clínica (multi-tenant) por diseño de datos (`clinic_id` + RLS), aunque hay una única clínica sembrada (`Clínica Podium`).

**[V]** Objetivo de negocio siguiente (no implementado): añadir un flujo de **valoración deportiva por grupos/equipos/jugadores** conservando el flujo individual. Ver §12.

---

## 2. Stack real

| Capa | Tecnología | Versión (package.json) |
|------|-----------|------------------------|
| Framework | Next.js **App Router** | `14.2.35` **[C]** |
| UI | React | `^18` **[C]** |
| Lenguaje | TypeScript (`strict: true`) | `^5` **[C]** |
| Estilos | Tailwind CSS | `^3.4.1` **[C]** |
| Backend/DB | Supabase (Postgres 17 **[V]**) vía `@supabase/ssr` `^0.9.0` + `@supabase/supabase-js` `^2.99.1` | **[C]** |
| IA — informes | Anthropic SDK `@anthropic-ai/sdk` `^0.39.0`, modelo `claude-sonnet-4-20250514` | **[C]** |
| IA — clasificación | Anthropic, modelo `claude-haiku-4-5-20251001` | **[C]** |
| IA — transcripción | OpenAI Whisper (`whisper-1`) vía `fetch` directo (sin SDK) | **[C]** |
| PDF | `jspdf` `^2.5.2`, `pdf-lib` `^1.17.1` | **[C]** |
| Iconos | `lucide-react` | **[C]** |
| Toasts | `react-hot-toast` | **[C]** |
| Utilidades | `uuid` | **[C]** |
| Runtime local | Node `v24.11.1`, npm `11.6.2` | **[C]** |
| Deploy | Vercel (push a `main` = deploy a producción) | **[C]** (ver §4bis) |

**[C]** No hay: tests, framework de testing, Storybook, ORM (Prisma/Drizzle), gestor de estado (Redux/Zustand), ni carpeta `supabase/functions` (no hay Edge Functions). Toda la lógica server-side vive en **API Routes de Next.js**.

---

## 3. Comandos útiles

```bash
npm install        # instalar dependencias
npm run dev        # arrancar en http://localhost:3000
npm run build      # build de producción (compila + typecheck) — VERIFICADO OK [C]
npm run start      # servir build de producción
npm run lint       # eslint (next lint)
```

**[C]** No hay script de test. **[C]** `npm run build` compila sin errores con solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` presentes (las páginas son `force-dynamic`, no golpean la DB en build).

---

## 4bis. Despliegue y flujo de trabajo Git (Vercel) — IMPORTANTE

> Flujo de trabajo acordado por el equipo. **Léelo antes de cualquier commit/push.**

### Regla de deploy
- **[C]** Deploy automático: **cada push a la rama `main` despliega TODO en Vercel** (producción). No hay ramas de preview en uso.
- **Siempre se trabaja en `main` en local.** No se crean ramas de feature. Se hace el trabajo, se prueba localmente y, **solo cuando todo está claro y listo**, se sube.
- Implicación: un push a `main` = producción en vivo. Nada de commits "a medias" en main; confirma que compila (`npm run build`) y funciona antes de subir.

### Apaño de autoría en los commits (para no pagar colaboradores en Vercel)
El proyecto en Vercel está asociado a la cuenta de **Jano Cabello**. Para evitar añadir colaboradores de pago, **todos los commits que se suben se firman como Jano**, y después se restaura la identidad de Sergio.

Identidades:
- **Autor "de subida" (para push):** `Jano Cabello <janocabellom@gmail.com>`
- **Autor por defecto de Sergio (restaurar después):** `Sergio Viver <sergiociria2@gmail.com>` — hoy configurado a nivel **global**, sin override local en este repo. **[C]**

**Procedimiento (acotado a ESTE repo con `--local` para no afectar otros repos de Sergio):**

```bash
# 1) Antes de commitear: cambiar autor a Jano SOLO en este repo
git config --local user.name  "Jano Cabello"
git config --local user.email "janocabellom@gmail.com"

# 2) Commit + push a main (esto despliega en Vercel)
git add -A
git commit -m "…"
git push origin main

# 3) Al terminar: restaurar a Sergio quitando el override local
git config --local --unset user.name
git config --local --unset user.email
# (al no haber config local, git vuelve a la global: Sergio Viver <sergiociria2@gmail.com>)
```

> ⚠️ Notas para el agente:
> - **Nunca** usar `git config --global` para este apaño (afectaría a todos los repos de Sergio). Usar siempre `--local`.
> - **Verificar** la identidad efectiva antes de commitear (`git config user.name && git config user.email`) y **volver a verificar** que se ha restaurado a Sergio después del push.
> - Recordar la política de este entorno: **no hacer commit/push salvo que el usuario lo pida explícitamente.**
> - Estado observado **[C]**: el último commit del repo está autorado por `Jano Cabello <janocabellom@gmail.com>` (coherente con este flujo).

---

## 4. Variables de entorno

Fichero: `.env.local` (en el repo local; en producción, variables de Vercel).

| Variable | Estado en `.env.local` | Necesaria para | Criticidad |
|----------|------------------------|----------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ presente | Todo | Crítica |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ presente | Auth + queries con RLS | Crítica |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **ausente** (comentada/no está) | Anamnesis pública, subida/borrado de documentos, invitar usuarios, clasificación IA, reset | Crítica |
| `ANTHROPIC_API_KEY` | ❌ **ausente** (comentada) | Generación de informes + clasificación | Alta |
| `OPENAI_API_KEY` | ❌ **ausente** (comentada) | Dictado por voz (transcripción) | Media |

**[C]** Consecuencia local: sin `SERVICE_ROLE_KEY`/`ANTHROPIC`/`OPENAI`, la app arranca y se navega, pero **fallan**: guardar anamnesis desde el enlace público, subir/borrar PDFs e imágenes, invitar usuarios, generar informe y clasificar. Los endpoints devuelven 500 controlado ("… no configurada").

---

## 5. Estructura de carpetas

```
src/
├── middleware.ts                     # Middleware raíz → updateSession()
├── app/
│   ├── layout.tsx                    # Root layout (fuentes Geist, Toaster)
│   ├── page.tsx                      # Landing/redirect
│   ├── globals.css
│   ├── (auth)/login/                 # Login (grupo de rutas sin sidebar)
│   ├── (dashboard)/                  # Grupo protegido CON sidebar
│   │   ├── layout.tsx                # Guard de sesión + <Sidebar>
│   │   ├── dashboard/                # "Inicio": KPIs, alertas, mis pacientes
│   │   ├── patients/                 # Lista, /new, /[id], /[id]/assessment, /[id]/report
│   │   ├── reports/                  # Listado de informes
│   │   ├── activity/                 # Actividad
│   │   └── settings/                 # Ajustes (perfil, clínica, equipo=staff, informe)
│   ├── anamnesis/[token]/            # PÚBLICA — formulario del paciente por token
│   ├── auth/                         # callback, confirm, update-password
│   ├── aviso-legal/ privacidad/ cookies/   # Páginas legales
│   └── api/                          # ← toda la lógica server-side (ver §8)
├── components/
│   ├── layout/Sidebar.tsx            # Navegación lateral + móvil
│   ├── patients/                     # PatientList, PatientFilters, AnamnesisActions, ClassifyBanner…
│   ├── anamnesis/                    # AnamnesisFormClient + anamnesisFields.ts
│   ├── assessment/                   # AssessmentForm + assessmentFields.ts (84 campos) + VoiceDictation
│   ├── documents/                    # DocumentSection/List/Uploader + ImageGallerySection
│   ├── report/                       # ReportEditor, ReportGenerateButton
│   └── settings/SettingsClient.tsx
├── lib/
│   ├── supabase/                     # client.ts, server.ts, admin.ts, middleware.ts
│   └── clinical/                     # stage.ts (etapa del paciente), taxonomy.ts (regiones/patologías/actividad)
└── types/database.ts                 # Tipos TS del modelo (mantenidos a mano)

supabase/migrations/
├── 001_initial_schema.sql            # Tablas + RLS + seed clínica
└── 002_patient_classification.sql    # Columnas de clasificación en patients
```

---

## 6. Modelo de datos

### 6.1 Tablas (migración `001`) **[C]**

Todas con `clinic_id` (multi-tenant) salvo `clinics`.

- **`clinics`** — `id, name, slug (unique), logo_url, address, phone, email`. Seed: `Clínica Podium` con UUID fijo `00000000-…-0001`.
- **`users`** — `id (= auth.users.id), clinic_id, full_name, email, role ('admin'|'physio'), avatar_url, is_active`.
- **`patients`** — `id, clinic_id, created_by, full_name, email, phone, date_of_birth, gender, notes, status ('active'|'inactive'|'archived')`.
- **`anamnesis_forms`** — `id, patient_id, clinic_id, token (uuid unique), status ('pending'|'in_progress'|'completed'|'expired'), form_data (JSONB), consent_data_processing, consent_ai_analysis, consent_timestamp, started_at, completed_at, expires_at (NOW()+7d)`.
- **`assessments`** — `id, patient_id, clinic_id, physio_id, session_number (default 1), status ('in_progress'|'completed'), assessment_data (JSONB), notes`.
- **`audio_recordings`** — `id, assessment_id, clinic_id, storage_path, duration_seconds, transcription, transcription_status`. **[I]** Definida pero apenas usada; el dictado transcribe y vuelca texto directamente (ver §7).
- **`documents`** — `id, patient_id, clinic_id, uploaded_by, doc_type ('vald_report'|'medical_image'|'external_report'|'other'), file_name, storage_path, extracted_data (JSONB), extraction_status`.
- **`reports`** — `id, patient_id, clinic_id, generated_by, status ('generating'|'draft'|'approved'|'delivered'), anamnesis_id, assessment_id, report_data (JSONB), pdf_storage_path, ai_model, ai_prompt_tokens, ai_completion_tokens`.

### 6.2 Migración `002` — clasificación en `patients` **[C]**

Añade: `body_region` (CHECK contra enum de regiones), `pathology_tag`, `pathology_label`, `activity_level` (CHECK), `classification_source ('ai'|'manual'|'ai_confirmed')`, `classification_confidence NUMERIC(3,2)`, `classified_at`. + índices para filtros de lista.

### 6.3 DRIFT de esquema — VALIDADO CONTRA LA DB REAL (⚠️) **[C]**

Inspección directa del proyecto de producción `njzqyttrlivipnkwmbbt` vía MCP `supabase-sherpa` (solo lectura), 2026-07:

- **`patients.vald_interpretation` NO EXISTE en la DB de producción.** **[C]** Confirmado por `information_schema.columns` → `false`. Sin embargo el código la lee y escribe (`api/reports/generate/route.ts`, `patients/[id]/page.tsx`, `documents/DocumentSection.tsx`). Consecuencia **no es solo drift, es un bug funcional silencioso** → ver §11 riesgo #5b: **la "interpretación VALD" que teclea el fisio se pierde** (el `update` falla y se traga el error; la lectura devuelve `undefined`; el informe IA nunca recibe ese texto).
- ~~**La tabla de migraciones de Supabase está VACÍA**~~ → **RESUELTO (Fase 0 Tarea 2, 2026-07).** Se creó el baseline `supabase/migrations/20260101000000_baseline_remote_schema.sql` (introspección real vía MCP) como migración inicial canónica; 001/002 movidas a `supabase/migrations/_legacy/` (superadas, no re-ejecutables). Historial remoto reparado a `[20260101000000_baseline, 20260723074241_drop]`. De aquí en adelante, cambios de esquema vía MCP `apply_migration` (registra en historial) + regenerar tipos. Ver `FASE-0-SANEAMIENTO.md` Tarea 2.
- **Storage buckets confirmados**: `documents` (**privado**) y `logos` (**público**). **[C]** Creados manualmente, no por migración. Nota: `logos` es público (los logos de clínica son accesibles sin firmar).
- **Objeto no documentado positivo — event trigger `ensure_rls` → `rls_auto_enable()`.** **[C]** Función `SECURITY DEFINER` (con `search_path` fijado a `pg_catalog`) que **activa RLS automáticamente en cualquier tabla nueva creada en `public`**. Es una red de seguridad *buena*, pero **no crea policies**: una tabla nueva queda con RLS ON y **sin policies = deny-all**. ⚠️ Relevante para el flujo de equipos: al crear `groups/teams/sports/...` tendrán RLS activado solo, y **hay que añadir las policies explícitamente** o todo quedará bloqueado.
- El endpoint de subida hace `storage.updateBucket('documents', { allowedMimeTypes })` en caliente con service_role. **[C]**

### 6.4b Volumen de datos en producción (2026-07) **[C]**
`clinics`=1, `users`=**12**, `patients`=2, `anamnesis_forms`=2, `assessments`=2, `documents`=1, `reports`=**0**, `audio_recordings`=0. Producción muy temprana: 12 usuarios reales pero apenas 2 pacientes y **ningún informe persistido todavía** (el flujo de informe puede no haberse ejercido aún en prod, o falla — **[V]** sin confirmar la causa).

### 6.4 RLS y policies (migración `001`) **[C]**

- Función `get_user_clinic_id()` (`SECURITY DEFINER`) → `clinic_id` del usuario autenticado.
- Todas las tablas con RLS habilitado, policies **scoped por clínica**.
- ⚠️ **`anamnesis_forms` tiene además dos policies públicas abiertas:**
  ```sql
  CREATE POLICY "Public can view anamnesis by token"   ... FOR SELECT USING (TRUE);
  CREATE POLICY "Public can update anamnesis by token" ... FOR UPDATE USING (TRUE);
  ```
  El comentario dice *"Token validation happens in the app"*. Ver §11 (riesgo de seguridad **crítico**).

---

## 7. Flujo funcional actual (individual)

**[C]** Todo el proceso vive dentro de la ficha del paciente (`/patients/[id]`), como 5 pasos "cableados":

1. **Anamnesis** — `AnamnesisActions` crea un `anamnesis_forms` (insert directo con el cliente anon del navegador) y genera un enlace `/anamnesis/{token}`. Se comparte por **WhatsApp** (`wa.me?text=…`) o **copiar al portapapeles**. No hay envío automático de email/WhatsApp desde backend. El paciente abre el enlace público, acepta consentimientos (datos + IA) y rellena el formulario; se autoguarda y se envía vía `PATCH /api/anamnesis/[token]` (service_role, valida token + expiración).
2. **Valoración del fisio** — `/patients/[id]/assessment`, formulario de **84 campos** (`assessmentFields.ts`) + **dictado por voz** (`VoiceDictation` → `POST /api/transcribe` → Whisper). Se guarda en `assessments.assessment_data` (JSONB) + `notes`.
3. **Informes VALD** — subida de PDFs (`documents`, `doc_type='vald_report'`). Además hay un campo de texto libre **interpretación VALD** que se guarda en `patients.vald_interpretation` (drift, ver §6.3).
4. **Ecografías/fotos** — imágenes clínicas (`documents`, `doc_type='medical_image'`), con captions y flag `include_in_report` guardados dentro de `extracted_data.notes` (JSON anidado dentro de JSONB).
5. **Informe final** — `POST /api/reports/generate` construye un contexto de texto con anamnesis + valoración + notas + interpretación VALD, llama a Claude Sonnet 4 con un `SYSTEM_PROMPT` largo que fija la estructura del informe (portada, resumen, exploración, conclusiones con Método Podium™ de 5 fases, descargo legal). Parsea el JSON de la respuesta, lo guarda como `reports` en estado `draft`. **Revisión humana obligatoria** en `/patients/[id]/report` (`ReportEditor`) → aprobar → exportar a PDF (`/api/reports/export-pdf`).

**[C]** Tras generar informe, se dispara **fire-and-forget** un `fetch` interno a `/api/patients/classify` (reenviando la cookie) para autoclasificar al paciente (región/patología/actividad) con Claude Haiku. También hay backfill masivo y override manual (PATCH).

**Etapa del paciente (`lib/clinical/stage.ts`)** **[C]**: función pura que deriva el estado operativo (`new → anamnesis_pending → …_progress → …_done → assessment_progress → assessment_done → report_draft → report_approved`) a partir de las relaciones. Se usa en lista y dashboard.

---

## 8. API Routes (server-side)

Todas en `src/app/api/**/route.ts`. Patrón general: `getUser()` → cargar `profile.clinic_id` → operar con scope de clínica.

| Ruta | Métodos | Función | Auth | Cliente |
|------|---------|---------|------|---------|
| `/api/anamnesis/[token]` | PATCH | Guardar/enviar anamnesis pública | **Token** (no sesión) | service_role |
| `/api/transcribe` | POST | Whisper (dictado) | Sesión | — (OpenAI fetch) |
| `/api/reports/generate` | POST | Informe IA (Claude Sonnet) | Sesión, clínica | anon (RLS) |
| `/api/reports/[id]` | — | CRUD informe | Sesión | anon |
| `/api/reports/export-pdf` | POST | PDF del informe | Sesión | — |
| `/api/patients/classify` | POST/PATCH | Clasificación IA + override manual | Sesión, clínica | service_role |
| `/api/patients/[id]` | DELETE… | Borrado paciente (+ ficheros storage) | Sesión, clínica | anon + service_role (storage) |
| `/api/documents` | POST/GET | Subir doc / signed URL | Sesión, clínica | anon + service_role (storage) |
| `/api/documents/[id]/notes` | — | Notas de documento | Sesión | anon |
| `/api/clinic`, `/api/clinic/logo` | — | Datos/logo de clínica | Sesión | anon/service_role |
| `/api/users/invite` | POST | Alta de usuario (invite o temp password) | **admin** | service_role |
| `/api/users/reset-password` | POST | Reset de contraseña | Sesión/admin | service_role |
| `/api/admin/reset-patients` | DELETE | **Borra TODOS los pacientes de la clínica** | **admin**, clínica | service_role |

---

## 9. Auth y permisos

- **[C]** Supabase Auth (email/password + invitación). `middleware.ts` → `updateSession()` refresca sesión y protege **solo** rutas que empiezan por `/patients` y `/settings`; `/anamnesis` es pública. **Nota:** `/dashboard`, `/reports`, `/activity` **no** están en la lista de `isProtectedRoute` del middleware, pero el `layout.tsx` de `(dashboard)` hace su propio guard (`redirect('/login')` si no hay user). Doble mecanismo, ligeramente inconsistente. **[C]**
- **[C]** Roles: `admin` | `physio`. Solo se comprueba `admin` en `users/invite` y `admin/reset-patients`. El resto de acciones son iguales para cualquier usuario de la clínica.
- **[C]** Aislamiento entre clínicas: vía `clinic_id` + RLS + `get_user_clinic_id()`. Varias rutas **además** filtran `clinic_id` en la query (defensa en profundidad); otras (p.ej. `patients/[id]/page.tsx`) confían **solo** en RLS.

---

## 10. Integraciones

- **IA (Anthropic):** informes (Sonnet 4) y clasificación clínica (Haiku 4.5). Prompts largos embebidos como constantes en las rutas. Parseo de JSON desde texto con regex (frágil). **[C]**
- **IA (OpenAI):** transcripción de voz (`whisper-1`) por `fetch` directo. **[C]**
- **VALD:** **NO hay integración con API de VALD.** Solo se **suben PDFs** como documentos y se añade **texto libre** de interpretación (`vald_interpretation`) + notas. Los datos de VALD llegan a la IA como texto/notas, no estructurados. La integración por API se considera futura. **[C]** (coincide con la hoja de requisitos)
- **PDF:** generación con `jspdf`/`pdf-lib`. **[C]**
- **Storage Supabase:** buckets `documents` y `logos` (privados, signed URLs a 1h). **[C]**

---

## 11. Riesgos conocidos y deuda técnica

### 🔴 Seguridad — crítico

1. ~~**RLS abierto en `anamnesis_forms`**~~ → ✅ **RESUELTO (Fase 0 Tareas 1 y 4, 2026-07).** Ambas policies `USING (TRUE)` (UPDATE y SELECT) han sido eliminadas. Ya **no** hay acceso indiscriminado con la anon key (verificado: rol `anon` lee 0 anamnesis). Se conserva abajo el análisis original como registro. **[C]**

   *(Histórico)* `USING (TRUE)` para SELECT y UPDATE permitía a cualquiera con la anon key (pública, va en el bundle) **leer y modificar TODAS las anamnesis de TODAS las clínicas** (PII clínica + consentimientos). La "validación de token en la app" no protegía a nivel de datos.

   **Análisis cerrado de cada policy [C]** (revisado `anamnesis/[token]/page.tsx` + `AnamnesisFormClient.tsx`):
   - **SELECT `USING(TRUE)` → ✅ ELIMINADA (Fase 0 Tarea 4, 2026-07).** Se migró primero la lectura de la página pública a un helper server-side con service_role (`src/lib/anamnesis/getByToken.ts`, valida token; la página ya no usa el cliente anon), se desplegó, y **después** se borró la policy (migración `20260724000000_drop_public_anamnesis_select_policy`). Verificado: el rol `anon` pasó de leer 2 anamnesis a **0**; la página pública sigue funcionando por token vía service_role.
   - **UPDATE `USING(TRUE)` → ✅ ELIMINADA (Fase 0 Tarea 1, 2026-07).** Era código muerto (el formulario del paciente escribe vía `fetch('/api/anamnesis/[token]')` con service_role; el fisio vía la policy clínica-scoped). Borrada en prod con migración `20260723074241_drop_public_anamnesis_update_policy` (archivo repo `supabase/migrations/003_*.sql`). Verificado 5→4 policies.
   - Efecto lateral **[C]**: el `select('*, patients(full_name)')` de la página pública hace join a `patients`, pero la RLS de `patients` bloquea ese join para el lector no autenticado ⇒ `patientName` llega vacío (la página funciona, pero puede no mostrar el nombre del paciente).

   **Estado real en producción (2026-07) [C]:** ambas policies `USING(TRUE)` **ya han sido eliminadas** (Tareas 1 y 4). `anamnesis_forms` conserva solo las 3 policies clínica-scoped (INSERT/SELECT/UPDATE). El advisor `rls_policy_always_true` deja de aplicar. *(Nota histórica: el linter marcaba la de UPDATE pero NO la de SELECT `USING(true)` —excluye por diseño los SELECT públicos—, pese a que era el vector real de fuga de PII; no fiarse de que el advisor no señale un SELECT abierto.)*

### 🟠 Seguridad / robustez — medio

2. **`patients/[id]/page.tsx`** carga el paciente con `.eq('id', id).single()` **sin** filtrar `clinic_id`: seguro solo si RLS está intacto; sin defensa en profundidad. **[C]**
3. **`/api/admin/reset-patients`** es un borrado masexo destructivo expuesto como endpoint; admin-only y clínica-scoped, pero de alto impacto. **[C]**
4. Fire-and-forget con **reenvío de cookie** entre rutas internas (`reports/generate` → `classify`): acoplamiento frágil y dependiente del entorno de despliegue. **[C]**

### 🔵 Security advisors de Supabase (validado en prod, 2026-07) **[C]**

`get_advisors(security)` sobre `njzqyttrlivipnkwmbbt` devuelve (todos WARN):

- **`rls_policy_always_true`** → policy `Public can update anamnesis by token` (UPDATE) — coincide con §11.1 (código muerto, borrar).
- **`function_search_path_mutable`** → `get_user_clinic_id` y `update_updated_at` no fijan `search_path`. Hardening recomendado (`SET search_path = ''` o `pg_catalog`).
- **`anon_security_definer_function_executable`** / **`authenticated_...`** → `get_user_clinic_id()` y `rls_auto_enable()` son ejecutables vía RPC por `anon`/`authenticated`. `get_user_clinic_id` para anon devuelve null (bajo riesgo); `rls_auto_enable` es una función de event trigger que fuera de contexto no hace nada útil. Aun así, lo pulcro es `REVOKE EXECUTE`.
- **`auth_leaked_password_protection`** → ✅ **ACTIVADA (Fase 0 Tarea 6, 2026-07, confirmado).** Comprobación contra HaveIBeenPwned habilitada en Auth. Es config de **Auth (GoTrue)**, NO gestionable por SQL/MCP → se activó **a mano** en el dashboard (Authentication → Leaked password protection). Verificado: el advisor `auth_leaked_password_protection` ya no aparece. Impacto: solo afecta a contraseñas **nuevas** (alta/cambio/reset); no invalida las existentes. Doc: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Ninguno es *ERROR*; son endurecimientos. El riesgo grave real (SELECT abierto de anamnesis) **no lo cubre el linter** — ver §11.1.

### 🟡 Deuda técnica / mantenibilidad

5. **Drift de esquema** (`vald_interpretation`, buckets, `rls_auto_enable`) fuera de migraciones; el historial de migraciones de Supabase está **vacío**. Las migraciones del repo **no reflejan** el estado real de la DB (ver §6.3, validado). **[C]**
5b. ✅ **RESUELTO (Fase 0 Tarea 5, 2026-07)** — se creó `patients.vald_interpretation TEXT` (migración `20260724163050`), se regeneraron tipos y se limpió el manejo de error en `DocumentSection` (ahora un fallo de guardado se ve, ya no se traga). La feature persiste y llega al informe. Se conserva abajo la descripción original del bug.

5b-hist. 🟠 *(Histórico)* **BUG FUNCIONAL — la "interpretación VALD" se perdía.** `patients.vald_interpretation` no existe en la DB, así que: (a) `DocumentSection.tsx` hace `update({ vald_interpretation })` que **falla y se traga el error** (`catch` con `console.warn "column may not exist yet"`), (b) `patients/[id]/page.tsx` lee `undefined` → el campo aparece siempre vacío al recargar, y (c) `reports/generate` nunca añade ese texto al contexto de la IA. **El texto que teclea el fisio sobre los informes VALD no se guarda ni llega al informe.** ⚠️ **El campo es visible y prominente en la UI** (paso 3 "Informes VALD" → "Interpretación del fisio", confirmado en captura 2026-07), así que un fisio lo usaría creyendo que funciona → pérdida de datos silenciosa de cara al usuario. Arreglo: crear la columna (vía migración) **o** eliminar el campo de la UI. **DECISIÓN (2026-07): se RECUPERA** → crear `patients.vald_interpretation TEXT` como primera migración de negocio sobre el baseline (ver `FASE-0-SANEAMIENTO.md` P1.1). **[C]**
6. **JSONB para todo** (`form_data`, `assessment_data`, `report_data`, captions dentro de `extracted_data.notes`): flexible pero sin validación de esquema ni tipado; la IA recibe concatenación de claves arbitrarias. Difícil de consultar/versionar. **[C]**
7. **Parseo de JSON del LLM con regex** (`match(/```json…/)`, `match(/\{[\s\S]*\}/)`): si el modelo se desvía, 500. Sin reintentos ni salida estructurada (tool use / JSON mode). **[C]**
8. **Modelos IA hardcodeados** en cada ruta (`claude-sonnet-4-20250514`, `claude-haiku-4-5-…`). Sin capa de configuración. **[C]**
9. **Duplicación** del cliente admin: existe `lib/supabase/admin.ts` pero varias rutas re-crean `createClient(url, serviceRoleKey)` inline. Unificar. **[C]**
10. **Orden de relaciones no determinista:** `patient.assessments?.[0]` / `reports?.[0]` asumen orden de inserción en unos sitios, mientras que anamnesis se ordena por fecha en otros. Riesgo de mostrar el registro equivocado con múltiples sesiones. **[C]**
11. ~~**`types/database.ts` mantenido a mano**~~ → **RESUELTO (Fase 0 Tarea 2, 2026-07).** `types/database.generated.ts` se autogenera desde Supabase (fuente de verdad); `types/database.ts` deriva de él (solo overrides no-nulos/enum a mano, que reflejan DEFAULT/CHECK reales). Regenerar con MCP `generate_typescript_types` al cambiar esquema. **[C]**
12. **README genérico** de `create-next-app` (no documenta nada del proyecto). Este `CLAUDE.md` lo suple. **[C]**
13. **Sin tests ni CI.** **[C]**
14. Señales de *vibe coding*: prompts gigantes embebidos, `console.error` como gestión de errores, `catch {}` vacíos, lógica de negocio (clasificación de imágenes, parsing) mezclada dentro de la ruta de generación de informe. **[C]**

---

## 12. Análisis de UX / navegación / arquitectura de información

### Navegación actual **[C]**
Sidebar plano (`components/layout/Sidebar.tsx`), 5 entradas: **Inicio** (`/dashboard`), **Pacientes**, **Informes**, **Actividad**, **Ajustes**. Móvil: bottom-nav con las 4 primeras. Marca "Podium / Clínica Podium".

### Evaluación

- **Modelo mental = paciente individual.** Toda la operativa clínica (anamnesis, valoración, VALD, imágenes, informe) está **embebida dentro de la ficha `/patients/[id]`** como 5 pasos fijos. No hay entidad "sesión/valoración" navegable por sí misma: `assessments` tiene `session_number` pero la UI trata **una sola** valoración por paciente. **[C]**
- **"Pacientes" está sobrecargado:** es simultáneamente el listado, el CRM operativo y el contenedor de todo el workflow clínico. Absorbe responsabilidades que en el escenario futuro deberían ser entidades propias (Sesiones/Valoraciones, Documentos, Informes). **[I]**
- **Listas planas, no jerarquías.** Lista de pacientes con filtros por región/patología/actividad/edad/etapa (buenos filtros clínicos), pero **sin ningún nivel organizativo** por encima del paciente. No existe Grupo, Equipo, ni Deporte en datos ni en navegación. **[C]**
- **Colisión de nomenclatura:** en **Ajustes** ya hay una pestaña **"Equipo"** que significa **el personal de la clínica (staff)**, no equipos deportivos. Meter "Equipos" deportivos chocará con este término. Hay que desambiguar (p.ej. "Personal/Staff" vs "Equipos"). **[C]**
- **Dashboard ("Inicio"):** orientado a operativa por-fisio (KPIs: mis pacientes, pendientes, nuevos, informes; alertas: anamnesis expirada, valoración/borrador estancados; distribución por etapa). Refleja bien estados operativos **del caso individual**, pero todo es "mis pacientes" — no hay agregación por equipo/grupo. Hay un bloque "Seguimiento — Próximamente". **[C]**
- **"Actividad":** es la vista **agregada de toda la clínica** (KPIs + "Embudo de pacientes" tipo funnel + "Actividad por fisio"). Distinta del Dashboard (que es por-fisio). Filtra explícitamente por `clinic_id` (defensa en profundidad). **[C]** Es el **anclaje natural para el reporting agregado de equipo** en el futuro, pero hoy es **plano**: funnel global + ranking por fisio, **sin ninguna dimensión de equipo/grupo/deporte**. **[I]**

### Validación visual (capturas 2026-07) **[C]**
Las capturas de la app en vivo confirman el análisis de código sin discrepancias. Observaciones adicionales que aportan las capturas:
- El **funnel de Actividad** muestra `Informes generados = 0` y `Valoraciones completadas = 0` → coherente con `reports=0` en la DB (§6.4b): **el flujo de informe IA + revisión + PDF no se ha ejercido nunca en producción todavía** (queda pendiente comprobar si es por falta de uso o por fallo).
- El campo **"Interpretación del fisio"** (paso 3) es visible y usable en la UI, pese a que **no persiste** (§5b).
- El `doc_type` de documentos **no se valida**: en la captura hay un `Justificante de Pago.pdf` subido como "Informe VALD". Cualquier PDF entra como `vald_report`. **[C]**
- Datos de prueba: los fisios están usando sus propios nombres como pacientes (p. ej. "Sergio Viver", "Jano Cabello" aparecen como pacientes **y** como staff). El roster de 12 usuarios de Actividad casi todo a 0 confirma fase de onboarding/prueba.
- **Facilidad para lo nuevo:** la estructura visual actual **frena** la incorporación de intake previo por lotes, consentimientos por equipo, configuración de deportes, mapeo deporte→pruebas y reporting agregado. Todo eso asume una capa organizativa (Grupo→Equipo→Jugador) y una entidad de Sesión configurable que hoy no existen. **[I]**

**Conclusión IA/UX:** la arquitectura de información actual es correcta y coherente **para el caso individual**, pero es una **jerarquía de un solo nivel (paciente)**. Escalar a equipos exige (a) una capa organizativa nueva, (b) convertir "valoración" en una entidad de **sesión** de primera clase y configurable por deporte, y (c) reorganizar la navegación lateral. No es un ajuste cosmético.

---

## 13. ¿Está el sistema preparado para el flujo nuevo (equipos)?

Leyenda: ✅ soportado · 🟡 parcial · ❌ no existe.

| Necesidad (hoja de requisitos) | Estado | Detalle **[C]/[I]** |
|--------------------------------|:------:|---------------------|
| **Pacientes individuales sin vinculación** | ✅ | Es el modelo actual completo. **[C]** |
| **Grupos** | ❌ | No hay tabla `groups` ni concepto. **[C]** |
| **Equipos** | ❌ | No hay tabla `teams`. Además "Equipo" ya se usa para staff (colisión). **[C]** |
| **Jugadores/pacientes vinculados a equipo** | ❌ | `patients` no tiene `team_id`/`group_id`. **[C]** |
| **Configuración por deporte** | ❌ | No hay `sports` ni deporte en `patients`/`teams`. **[C]** |
| **Mapeo deporte → pruebas** | ❌ | No existe catálogo de pruebas ni relación deporte-prueba. `assessment_data` es JSONB libre, no un catálogo configurable. **[C]** |
| **Sesiones guiadas por pasos** | 🟡 | La ficha `/patients/[id]` es *step-like* (5 pasos), pero **hardcodeada** y con **una** valoración por paciente; `session_number` existe pero no hay entidad "sesión" navegable/configurable. **[C]** |
| **Adjuntar PDFs de VALD** | ✅ | `documents.doc_type='vald_report'` + storage + signed URLs. La **integración por API** de VALD sigue siendo futura. **[C]** |
| **Notas por prueba** | 🟡 | Hoy hay notas por documento y notas generales de valoración; no "por prueba" (no hay entidad prueba). **[C]** |
| **Informe individual IA** | ✅ | Implementado (Sonnet 4) + revisión humana. **[C]** |
| **Informe agregado de equipo** | ❌ | No existe; requeriría la capa de equipo + agregación. **[C]** |

**Resumen:** el flujo **individual** está soportado de punta a punta. **Todo lo relativo a estructura organizativa (grupo/equipo/deporte/pruebas) y agregación de equipo NO existe** ni en datos ni en UI. Para el nuevo flujo hará falta modelado nuevo (tablas + RLS), una entidad de **sesión** de primera clase, un **catálogo de pruebas y deportes** configurable, y una reorganización de la navegación. El flujo individual y el nuevo pueden convivir si el paciente admite vinculación **opcional** a equipo (nullable), preservando el caso suelto.

---

## 14. Recomendaciones para futuros agentes

### ✅ Prioridad alta — sistema de migraciones (RESUELTO en Fase 0 Tarea 2, 2026-07)
**[C]** Ya está: baseline `20260101000000_baseline_remote_schema.sql` reflejando el estado real, 001/002 en `_legacy/`, historial remoto reparado, y tipos generados desde Supabase. **De aquí en adelante toda tabla/columna/policy/bucket va por migración versionada** (MCP `apply_migration`) + regenerar `types/database.generated.ts`. El texto de abajo se conserva como registro del enfoque seguido.

**[C]** (Histórico) El historial de migraciones estaba **vacío** y los cambios se aplicaban a mano en el SQL editor de producción. Era la **causa raíz** del drift (§6.3) y del bug de `vald_interpretation` (§5b). Enfoque de reconciliación aplicado:

Matiz: como la DB **ya tiene estado** pero **sin historial**, no basta con "activarlo"; hay que **reconciliar repo ↔ DB** primero (trabajo de diseño, fuera de la fase de auditoría):
1. **Baseline** del esquema real actual (p. ej. `supabase db pull`) → una migración inicial que capture lo que hoy falta en el repo (`rls_auto_enable`, policies reales, buckets si aplica, y `vald_interpretation` si se decide conservarla).
2. **Marcar 001/002 como ya aplicadas** (o fundirlas en el baseline) para que el tooling no intente re-ejecutarlas.
3. A partir de ahí, **toda columna/policy/tabla/bucket nuevo pasa por una migración versionada**; nada de SQL manual en prod.
4. **Generar `types/database.ts` desde Supabase** en vez de mantenerlo a mano.

### Otras
- **Antes de tocar datos:** el drift de §6.3 ya está **validado [C]**; el riesgo más grave sigue siendo las policies públicas de `anamnesis_forms` (§11.1).
- **Migraciones como fuente de verdad:** ver bloque de prioridad alta arriba.
- **No confíes solo en RLS** en páginas server: filtra también por `clinic_id` (defensa en profundidad), sobre todo si se añade la capa de equipos.
- **Para el flujo de equipos (cuando se apruebe):** trátalo como **entidades nuevas** (`groups`, `teams`, `sports`, `tests`, `sport_tests`, `sessions`) con `team_id` **nullable** en `patients` para no romper el caso individual. Convierte la valoración en una **sesión** con pasos derivados del deporte.
- **Desambigua "Equipo"** (staff) vs "Equipos" (deportivos) en la UI antes de introducir el nuevo concepto.
- **IA:** considera salida estructurada (tool use/JSON) en lugar de parsear texto con regex; externaliza modelos y prompts a configuración.
- **Cambios mínimos y explicados** mientras siga la fase de auditoría; no implementes el flujo nuevo sin diseño aprobado.

---

## 15. Estado de validación / incertidumbres abiertas

- ~~**DB de producción no inspeccionada**~~ → **RESUELTO [C]:** se configuró un MCP `supabase-sherpa` (scope `local`, `--read-only`, `--project-ref=njzqyttrlivipnkwmbbt`) apuntando al proyecto real. Validado: `vald_interpretation` **no existe** (bug §5b), buckets `documents`(priv)/`logos`(púb) **sí existen**, ambas policies `USING(TRUE)` **desplegadas**, historial de migraciones **vacío**, event trigger `ensure_rls` presente. Ver §6.3, §6.4b, §11 y §16.
- ~~**Lectura de la página pública de anamnesis**~~ → **RESUELTO [C]**: lee vía cliente anon en server component, depende de la policy `SELECT USING(TRUE)` (ver §11.1). La escritura va por service_role. La policy `UPDATE USING(TRUE)` es código muerto.
- **Deploy:** confirmado Vercel con auto-deploy en push a `main` (ver §4bis). No hay `vercel.json` ni workflow de CI en el repo; el deploy lo gestiona la integración de Vercel, no un workflow versionado.
- **Envío de anamnesis:** hoy es manual (WhatsApp/copiar enlace); no hay envío automatizado por backend.
- **[V] pendiente:** `reports`=0 en prod y el funnel de Actividad muestra `Informes generados=0` → **el flujo de informe IA nunca se ha completado en producción**. Falta confirmar si es por falta de uso o porque la generación falla (p. ej. `ANTHROPIC_API_KEY` en Vercel, parseo JSON, etc.).

---

## 16. Acceso a la DB de producción vía MCP (solo lectura)

**[C]** Este repo tiene configurado un servidor MCP **local** (privado a esta carpeta, no commiteado) para inspeccionar la DB real en modo **solo lectura**:

- Nombre: `supabase-sherpa` · scope `local` (en `~/.claude.json`, atado a la ruta del repo).
- Flags: `--read-only --project-ref=njzqyttrlivipnkwmbbt` → **solo puede leer, y solo el proyecto SHERPA** (no toca `evaluameFP`/`bitacorafp`).
- Token: Personal Access Token de Supabase (de cuenta) pasado por env `SUPABASE_ACCESS_TOKEN`. El aislamiento a un único proyecto lo garantiza `--project-ref`, no el token.

> Para **aplicar** cambios (p.ej. corregir policies o crear la columna `vald_interpretation`) hay que quitar `--read-only` puntualmente o usar una variante con escritura. Mientras dure la auditoría, se mantiene solo lectura.
> Reproducir el alta: ver el historial de este trabajo o el comando `claude mcp add supabase-sherpa -s local -e SUPABASE_ACCESS_TOKEN=… -- npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=njzqyttrlivipnkwmbbt`. **Nunca** usar scope `project` (commitearía el `.mcp.json`).

---

## 17. Flujo de equipos (Prompt 2/3) — progreso de implementación

**[C]** Diseño y plan en `DISENO-EQUIPOS.md` y `PLAN-IMPLEMENTACION-EQUIPOS.md`. Fases A–G; el caso individual se conserva (todo aditivo, `patients.team_id` NULLABLE).

### Fase A — Organización + roster (COMPLETADA 2026-07). Doc: `FASE-A-EQUIPOS.md`
- **Datos:** tablas `groups` y `teams` (clínica-scoped, RLS `FOR ALL` USING+WITH CHECK); `patients.team_id` NULLABLE (FK→teams ON DELETE SET NULL). Migración `20260725152017_create_groups_teams_and_patient_team_link`.
- **Rutas nuevas:** `/groups` (lista+crear grupo), `/groups/[id]` (equipos+crear equipo), `/teams/[id]` (roster + "Añadir jugador"). Añadidas a `isProtectedRoute` (`lib/supabase/middleware.ts`).
- **Componentes:** `components/teams/CreateGroupForm.tsx`, `CreateTeamForm.tsx` (insert autenticado + `router.refresh()`).
- **Alta de jugador:** `patients/new?team_id=` fija el equipo y vuelve al roster.
- **Ficha/lista:** `/patients/[id]` muestra card "Equipo"; `/patients` tiene filtro por equipo / "Sin equipo" (`PatientFilters` prop `teams`).
- **UX:** Ajustes "Equipo" (staff) → **"Personal"** (el `id` interno del tab sigue siendo `team`); sidebar nueva entrada **"Equipos"** (→ `/groups`, icono Shield). Nota menor: "Equipos" no resalta en `/teams/[id]` (match `startsWith('/groups')`).
### Fase B — Deportes y pruebas (COMPLETADA 2026-07). Doc: `FASE-B-EQUIPOS.md`
- **Datos:** tablas `sports`, `tests` (con `vald_interpretation_prompt` + `result_schema` JSONB reservado), `sport_tests` (N:M, UNIQUE `sport_id,test_id`); `teams.sport_id`/`patients.sport_id` NULLABLE (FK→sports ON DELETE SET NULL). Migración `20260725230101_create_sports_tests_and_sport_link`. RLS `FOR ALL` clínica-scoped en las 3.
- **Config (Ajustes → pestaña "Deportes y pruebas"):** `/settings/tests` (catálogo de pruebas CRUD + prompt, `TestsManager`), `/settings/sports` + `/settings/sports/[id]` (deportes + editor de mapeo deporte→pruebas con orden/requerida, `SportTestsEditor`).
- **Asignación:** deporte del equipo (`/teams/[id]`) y override del paciente (`/patients/[id]`) vía `components/sports/SportSelect.tsx`.
- **Resolución:** helper puro `lib/clinical/sport.ts` `resolveSport()` = `session ?? patient ?? team` (sin consumidor hasta Fase D).
- **Sin efecto en runtime aún:** deportes/pruebas NO dirigen ninguna valoración hasta la Fase D (entidad sesión).

### Fase C — Consentimientos y trazabilidad (COMPLETADA 2026-07). Doc: `FASE-C-EQUIPOS.md`
- **Datos:** `consent_versions` (textos versionados por tipo: `data_processing`/`info_treatment`/`ai_analysis`, `is_active`) y `consents` (registro con **copia** `version_body` para trazabilidad; FK a patients/anamnesis_forms). Migración `20260727154457_create_consents_and_consent_versions`. RLS: `consent_versions` `FOR ALL` clínica-scoped; `consents` SELECT+INSERT clínica-scoped (la escritura pública va por **service_role**, sin policy pública).
- **Config:** Ajustes → pestaña **"Consentimientos"** → `/settings/consents` (`ConsentsManager`: edita el texto vigente por tipo).
- **Anamnesis pública:** ahora **3** consentimientos (añadido "tratamiento de la información"); textos servidos desde `consent_versions` (fallback a textos por defecto). Al **enviar**, `/api/anamnesis/[token]` (service_role) registra 3 filas en `consents` (delete+insert idempotente por `anamnesis_id`); **no fatal** (un fallo no bloquea el envío). Los flags `consent_data_processing`/`consent_ai_analysis` en `anamnesis_forms` se conservan; `info_treatment` solo vive en `consents` (se siembra de `preConsented` en el cliente).
- **Trazabilidad:** card "Consentimientos" en la ficha del paciente (tipo · aceptado/rechazado · fecha). Módulo compartido `lib/clinical/consents.ts` (tipos + labels).

> Esto **actualiza** afirmaciones previas del doc (p. ej. §13 "no hay grupos/equipos ni deportes/pruebas"): esas describen el punto de partida de la auditoría; la capa organizativa (Fase A), los catálogos deporte/prueba (Fase B) y los consentimientos versionados (Fase C) ya existen.
