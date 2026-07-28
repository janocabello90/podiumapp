# Fase E — Campañas (mini-plan de fase)

> Doc de la Fase E (nueva, ver adendas de `DISENO-EQUIPOS.md` y `PLAN-IMPLEMENTACION-EQUIPOS.md`).
> **Objetivo:** entidad **campaña** = estudio de valoración de un grupo (subconjunto de sus equipos), que **agrupa** las sesiones de ese estudio. Distingue campaña vs individual y habilita el informe agregado por campaña (Fase G).
> **Riesgo:** 🟡 medio — aditivo (`sessions.campaign_id` nullable → individual = null); reutiliza el stepper de sesión de la Fase D.
> **Criterio de "completada":** se crea una campaña sobre un grupo (eligiendo equipos, fechas, seguimientos), se ve el roster con progreso, y "valorar jugador" crea una sesión **con `campaign_id`**; el flujo individual intacto; `npm run build` verde.

## Reglas (confirmadas con la clínica)
1. Campaña = **un grupo**; incluye **subconjunto** de sus equipos.
2. Una sesión pertenece **como mucho a una campaña** (`campaign_id` nullable).
3. Se valora a los jugadores de los equipos incluidos (todos o los que se presenten). Progreso = valorados vs roster.
4. Campaña con **inicio + fin previsto (opcional) + nº de seguimientos previstos**.
5. Pueden coexistir **varias campañas** independientes.

---

## Diseño de esquema (migración E1)

**`campaigns`**
- `id` uuid PK · `clinic_id` NOT NULL → clinics CASCADE · `group_id` NOT NULL → groups CASCADE
- `name` text NOT NULL
- `status` text CHECK `IN ('active','closed')` default `'active'`
- `start_date` date · `end_date_planned` date NULL · `planned_consultations` int NULL · `closed_at` timestamptz NULL
- `notes` text · `created_at`, `updated_at` (+ trigger)

**`campaign_teams`** (subconjunto de equipos del grupo)
- `id` uuid PK · `clinic_id` NOT NULL → clinics CASCADE · `campaign_id` NOT NULL → campaigns CASCADE · `team_id` NOT NULL → teams CASCADE
- `created_at` · UNIQUE(campaign_id, team_id)

**`sessions.campaign_id`** NULLABLE → campaigns ON DELETE SET NULL.

Índices: `campaigns(group_id)`, `campaigns(clinic_id)`, `campaign_teams(campaign_id)`, `campaign_teams(team_id)`, `sessions(campaign_id)` parcial.
RLS: `FOR ALL` clínica-scoped en `campaigns` y `campaign_teams` (recordar `ensure_rls` = deny-all).

---

## Tareas

### E1 — Migración + tipos
- `campaigns` + `campaign_teams` + `sessions.campaign_id` + índices + trigger + RLS, vía `apply_migration`; archivo repo.
- Regenerar tipos + alias `Campaign`, `CampaignTeam` en `database.ts`.
- `npm run build`. **Aceptación:** tablas + policies (`pg_policies`), build OK.

### E2 — Crear y listar campañas (en el grupo) + detalle
- `/groups/[id]`: sección **"Campañas"** del grupo (lista + crear). `CreateCampaignForm` (nombre, equipos del grupo [checkboxes], inicio, fin previsto, nº seguimientos) → inserta `campaigns` + `campaign_teams`.
- `/campaigns/[id]`: detalle — datos (estado/fechas), **equipos incluidos**, **roster** (jugadores de esos equipos) con **progreso** (¿tiene sesión en esta campaña?).
- **Aceptación:** crear campaña con equipos/fechas; ver detalle con roster y progreso.

### E3 — Valorar dentro de campaña + seguimientos
- `POST /api/sessions` acepta `campaignId` opcional → `sessions.campaign_id`. `StartSessionButton` acepta `campaignId`.
- En `/campaigns/[id]`, por jugador: botón **"Valorar"** → crea sesión con `campaign_id` → abre el stepper (Fase D). Soporta **seguimientos** (varias sesiones del jugador en la campaña).
- **Aceptación:** valorar un jugador desde la campaña crea una sesión con `campaign_id`; el progreso avanza.

### E4 — Cierre de campaña + QA + docs + commit
- Botón "Cerrar campaña" (`status='closed'`, `closed_at`). (El informe de campaña es Fase G.)
- Checklist. `CLAUDE.md` §17 (Fase E) + cerrar este doc. Commits Jano.

---

## Navegación
- Campañas colgadas del **grupo** (`/groups/[id]` → sus campañas) + detalle `/campaigns/[id]`. (Un listado top-level "Campañas" en sidebar queda como mejora futura.)
- `/campaigns` se añade a `isProtectedRoute` del middleware.

## Checklist de QA
1. **Regresión:** valoración individual (Fase D) y flujo antiguo intactos (`campaign_id` null).
2. Crear campaña sobre un grupo con 1-2 equipos, fechas y nº seguimientos.
3. Ver detalle: equipos incluidos + roster de jugadores + progreso 0/N.
4. "Valorar" un jugador → crea sesión con `campaign_id` → progreso 1/N; repetir (seguimiento) crea otra sesión.
5. Una sesión individual (desde la ficha) sigue con `campaign_id` null.
6. RLS: otra clínica no ve campañas ajenas. `npm run build` verde.

## Notas / riesgos
- Aditivo; `sessions.campaign_id` nullable → individual sin cambios.
- El **informe de campaña** (agregación IA) es **Fase G**, no aquí.
- Reutiliza el stepper de sesión de la Fase D tal cual (la sesión solo se "etiqueta" con la campaña).

---

## Registro de ejecución
- **E1** — ✅ **HECHA (2026-07-28).** `campaigns` + `campaign_teams` + `sessions.campaign_id` (migración `20260728074407`) + RLS `FOR ALL` clínica-scoped (verificado `pg_policies`). Tipos + alias `Campaign`/`CampaignTeam`. Build OK.
- **E2** — ✅ **HECHA (2026-07-28).** `/groups/[id]` sección "Campañas" (`CreateCampaignForm`: nombre, equipos, fechas, nº seguimientos) + lista. `/campaigns/[id]` detalle: info + progreso (valorados/total) + roster por equipo.
- **E3** — ✅ **HECHA (2026-07-28).** `POST /api/sessions` acepta `campaignId`; `StartSessionButton` acepta `campaignId`. En el roster de la campaña, "Valorar/Seguimiento" crea sesión con `campaign_id` y abre el stepper. `/campaigns` en middleware.
- **E4** — ✅ **HECHA (2026-07-28).** Cerrar campaña (`CloseCampaignButton`: status='closed'+closed_at). `CLAUDE.md` §17 (Fase E). Doc cerrado. Build OK (33 páginas). Commits Jano.

**Fase E COMPLETADA.** Siguiente: Fase F (VALD por sesión + informe individual sobre sesión) y Fase G (informe de campaña).
