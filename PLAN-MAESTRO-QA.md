# Plan maestro de QA — SHERPA (podium-app)

> Guía única para testear **todos los flujos** de la app y confirmar que funcionan en condiciones.
> **Entorno de prueba:** el **deploy de producción** (Vercel), que es donde están las API keys y el service_role. Muchos flujos **no** funcionan en local por faltar `SUPABASE_SERVICE_ROLE_KEY`/`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` en `.env.local` (ver §0).
> **Cómo usarlo:** recorre las suites en orden; marca cada caso en la columna **Estado** (⬜ pendiente · ✅ ok · ❌ falla · ⚠️ con matices). Anota incidencias al final (§Registro).
> **Naturaleza:** QA **manual** (no hay framework de tests). La automatización (Playwright/CI) queda como mejora futura (§Automatización).

> ### ⚠️ Actualización 2026-08 (leer antes de recorrer)
> Tras el trabajo de **refinamiento post-equipos** (ver `POST-EQUIPOS-REFINAMIENTO.md`), varias suites de abajo quedaron **desfasadas**. Cambios que afectan al recorrido:
> - **`/campaigns` → `/estudios`** (renombrado de URL; donde ponga `/campaigns`, es `/estudios`).
> - **Top bar**: ahora es **solo migas de pan** (se quitaron buscador, campana y chip de usuario) → §2.2 obsoleto.
> - **CTA "Nueva consulta"** del pie del sidebar: **eliminado** → §2.3 obsoleto.
> - **Ajustes**: el rail incluye ahora **Anamnesis** (§6.1); Consentimientos tiene **4 tipos** (se añadió Derechos de imagen).
> - **Anamnesis de equipo**: hasta **4 consentimientos** (los 3 + imagen) y flujo de **menor** → §10 ampliado en §18.
> - **Caducidad de anamnesis**: **14 días** (no 7) → §10.6.
> - **Roles admin/fisio** reales → nueva **§16**. **Consulta distinta por tipo de paciente** → nueva **§19**.
> **Suites nuevas: §16 Roles · §17 Anamnesis/plantillas/exploración · §18 Consentimientos (imagen + menores) · §19 Consulta por tipo.**

---

## 0. Prerrequisitos y entorno (hacer ANTES de empezar)

| # | Comprobación | Cómo | Estado |
|---|---|---|---|
| 0.1 | **Env keys en Vercel** (producción): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Vercel → Project → Settings → Environment Variables | ⬜ |
| 0.2 | **Último deploy verde** (build sin errores) tras el último push | Vercel → Deployments | ⬜ |
| 0.3 | **Usuario admin** disponible (para invitar/borrar) y un **usuario physio** para probar roles | Supabase Auth / Ajustes → Personal | ⬜ |
| 0.4 | **Datos de prueba** sembrados (ver §Datos de prueba) o listos para crear durante el test | — | ⬜ |
| 0.5 | Navegador con **caché limpia** (o incógnito) para ver logos/favicon nuevos | Cmd+Shift+R | ⬜ |

### Matriz de dependencias de entorno (qué rompe si falta una key)
| Flujo | Necesita | Si falta |
|---|---|---|
| Guardar/enviar anamnesis pública | `SERVICE_ROLE_KEY` | 500 controlado; no guarda |
| Subir/borrar documentos e imágenes | `SERVICE_ROLE_KEY` | error de subida |
| Invitar usuarios / reset / reset-patients | `SERVICE_ROLE_KEY` | 500 |
| Generar informe individual y de campaña | `ANTHROPIC_API_KEY` | 500 "API key no configurada" |
| Clasificación IA del paciente | `ANTHROPIC_API_KEY` | clasificación no se aplica (no bloquea) |
| Dictado por voz (transcripción) | `OPENAI_API_KEY` | dictado falla |

> **Nota histórica:** en prod había `reports=0`; conviene confirmar en 0.1 que `ANTHROPIC_API_KEY` está presente antes de dar por fallido el flujo de informe.

---

## 1. Autenticación y acceso

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 1.1 | Login con credenciales válidas | Entra a `/patients`; sesión iniciada | ⬜ |
| 1.2 | Login con credenciales inválidas | Toast "Credenciales incorrectas"; no entra | ⬜ |
| 1.3 | "¿Olvidaste tu contraseña?" → enviar email | Mensaje de envío; llega correo de reset (revisar spam) | ⬜ |
| 1.4 | Completar reset desde el enlace del correo | Cambia contraseña; permite entrar | ⬜ |
| 1.5 | Acceder a `/patients` / `/settings` / `/campaigns` sin sesión | Redirige a `/login` | ⬜ |
| 1.6 | Estando logueado, ir a `/login` | Redirige a `/patients` | ⬜ |
| 1.7 | Logo/favicon/marca | Login muestra logo SHERPA grande; pestaña con favicon teal | ⬜ |

---

## 2. Navegación y shell (transversal)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 2.1 | Sidebar escritorio | Marca SHERPA (icono + tagline), entradas Inicio·Estudios·Pacientes·Equipos·Informes·Actividad·Ajustes; activo resaltado | ⬜ |
| 2.2 | Top bar | Breadcrumb por sección, buscador (→Pacientes), campana (→Inicio), chip usuario con rol | ⬜ |
| 2.3 | CTA "Nueva consulta" (pie del sidebar) | Lleva a `/patients` | ⬜ |
| 2.4 | Móvil | Cabecera con logo SHERPA; menú lateral; bottom-nav con 4 primeras | ⬜ |
| 2.5 | Cerrar sesión | Vuelve a `/login` | ⬜ |

---

## 3. Inicio (dashboard)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 3.1 | Entrar a Inicio | KPIs: Estudios activos · Consultas 7d · Informes por revisar · Pacientes activos | ⬜ |
| 3.2 | Conmutador **Toda la clínica / Míos** | Cambia scope (KPIs, alertas, distribución, consultas) vía `?scope=mine` | ⬜ |
| 3.3 | **Estudios activos** (tarjetas) | Progreso valorados/total correcto; enlaza a `/campaigns/[id]` | ⬜ |
| 3.4 | **Consultas recientes** | Últimas sesiones con tipo/estado/fecha; enlaza a la sesión | ⬜ |
| 3.5 | **Alertas** | Anamnesis expirada / valoración estancada / borrador sin aprobar; enlaza al paciente | ⬜ |
| 3.6 | KPI clicables | "Estudios activos"→/campaigns, "Pacientes activos"→/patients | ⬜ |

---

## 4. Flujo INDIVIDUAL del paciente (regresión crítica — debe seguir intacto)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 4.1 | Alta de paciente individual (sin equipo) `/patients/new` | Se crea; aparece en la lista y en su ficha | ⬜ |
| 4.2 | Ficha: **Historial de consultas** | Timeline con sesiones (vacío si nuevas); botón "Nueva consulta" | ⬜ |
| 4.3 | Enviar **anamnesis** (WhatsApp / copiar enlace) | Genera enlace `/anamnesis/{token}` | ⬜ |
| 4.4 | Paciente rellena anamnesis y **envía** (ver §10) | Estado pasa a "completada"; visible al Actualizar | ⬜ |
| 4.5 | Iniciar **sesión/valoración** → exploración (84 campos) + dictado voz | Guarda `clinical_data`; dictado transcribe (necesita OPENAI) | ⬜ |
| 4.6 | Subir **PDF VALD** + **imagen** (nivel paciente) | Se suben; aparecen; interpretación del fisio persiste | ⬜ |
| 4.7 | **Generar informe** (desde ficha) | Crea borrador IA (necesita ANTHROPIC); redirige a revisión | ⬜ |
| 4.8 | Revisar/editar → **aprobar** → **exportar PDF** | Aprueba; PDF se descarga con marca | ⬜ |
| 4.9 | Multi-sesión: crear **2ª sesión** (seguimiento) | Aparece como "Seguimiento 1" en el timeline | ⬜ |
| 4.10 | Borrar paciente (+ ficheros) | Se elimina; storage limpiado | ⬜ |

---

## 5. Sesiones (entidad de valoración)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 5.1 | Página de sesión `/patients/[id]/sessions/[sessionId]` | Stepper: anamnesis+consentimientos · exploración · pruebas · VALD · imágenes · informe | ⬜ |
| 5.2 | **Pruebas según deporte** | Si el paciente/equipo tiene deporte con pruebas mapeadas, aparecen en el paso 3 | ⬜ |
| 5.3 | **Notas por prueba** | Se guardan por prueba | ⬜ |
| 5.4 | VALD/imágenes **por sesión** (paso 4/5) | Documentos quedan ligados a esa sesión (`session_id`) | ⬜ |
| 5.5 | **Informe desde la sesión** (paso 6) | Usa esa sesión; contexto incluye notas + prompts VALD por prueba | ⬜ |

---

## 6. Configuración (`/settings`)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 6.1 | **Rail vertical** de secciones | Perfil·Clínica·Personal·Deportes y pruebas·Consentimientos·Informe (vertical en desktop) | ⬜ |
| 6.2 | **Mi perfil**: cambiar nombre | Guarda | ⬜ |
| 6.3 | **Clínica**: datos + subir **logo** | Guarda; logo visible (necesita SERVICE_ROLE) | ⬜ |
| 6.4 | **Personal**: invitar usuario (admin) | Alta por invitación/contraseña temporal (necesita SERVICE_ROLE + admin) | ⬜ |
| 6.5 | **Personal**: activar/desactivar / reset contraseña | Funciona; físio sin permisos admin no puede invitar | ⬜ |
| 6.6 | **Deportes y pruebas** → `/settings/tests`: crear prueba + prompt VALD | Se crea; editable con **botón Guardar** | ⬜ |
| 6.7 | `/settings/sports` + `/settings/sports/[id]`: crear deporte + **mapear pruebas** (orden/requerida) | Guarda el mapeo con feedback | ⬜ |
| 6.8 | **Consentimientos** `/settings/consents`: editar texto vigente por tipo | Guarda la versión activa | ⬜ |

---

## 7. Equipos (roster)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 7.1 | Crear **grupo** `/groups` | Se crea; entra a `/groups/[id]` | ⬜ |
| 7.2 | Crear **equipo** dentro del grupo | Aparece en el grupo | ⬜ |
| 7.3 | Asignar **deporte** al equipo | Selector guarda con feedback | ⬜ |
| 7.4 | **Añadir jugador** (`/teams/[id]` → alta con team_id) | Jugador en el roster con su estado clínico | ⬜ |
| 7.5 | **Alta masiva CSV** (plantilla → rellenar → importar) | Preview con estados; crea válidos con team_id; duplicado por email excluido | ⬜ |
| 7.6 | **Alta masiva XLSX** | Igual que CSV (parseo primera hoja) | ⬜ |
| 7.7 | CSV con `;` (Excel-ES) + fechas dd/mm/aaaa | Parseado correctamente | ⬜ |

---

## 8. Estudios / Campañas

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 8.1 | **Lista `/campaigns`** (Estudios) | Activos/Finalizados con progreso real; vacío enlaza a Equipos | ⬜ |
| 8.2 | Crear **campaña** sobre un grupo (`/groups/[id]` → Campañas): equipos + fechas + nº seguimientos | Se crea; aparece en el grupo y en /campaigns | ⬜ |
| 8.3 | **Detalle `/campaigns/[id]`**: roster por equipo + progreso valorados/total | Correcto | ⬜ |
| 8.4 | **Valorar** un jugador en la campaña | Crea sesión con `campaign_id`; progreso sube | ⬜ |
| 8.5 | **Seguimiento** (2ª valoración en campaña) | Otra sesión del jugador en la campaña | ⬜ |
| 8.6 | **Cerrar campaña** | Estado "Cerrada"; sigue consultable | ⬜ |

---

## 9. Informe de campaña (IA agregado)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 9.1 | Rail "Informe de campaña (IA)" en `/campaigns/[id]` | Sin informe: CTA generar (gating ≥1 valorado). Con informe: preview del resumen + jugadores a vigilar + cobertura | ⬜ |
| 9.2 | **Generar** con roster parcial | Informe cualitativo con aviso de cobertura X/N (necesita ANTHROPIC) | ⬜ |
| 9.3 | **Revisar `/campaigns/[id]/report`**: editar secciones | Guarda | ⬜ |
| 9.4 | **Aprobar** + **PDF de campaña** | Aprueba; PDF propio se descarga | ⬜ |
| 9.5 | Botón deshabilitado sin nadie valorado | No permite generar; aviso | ⬜ |

---

## 10. Anamnesis pública (`/anamnesis/[token]`)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 10.1 | Abrir el enlace como paciente (sin sesión) | Carga el formulario por token | ⬜ |
| 10.2 | **3 consentimientos** (datos, tratamiento info, IA) | Se muestran los textos vigentes | ⬜ |
| 10.3 | Rellenar + autoguardado | Guarda progreso (necesita SERVICE_ROLE) | ⬜ |
| 10.4 | **Enviar** | Estado "completada"; registra 3 filas en `consents` | ⬜ |
| 10.5 | Trazabilidad en ficha | Card "Consentimientos" muestra tipo/aceptado/fecha | ⬜ |
| 10.6 | Enlace **expirado** (>14 días) | Rechaza el envío; ficha muestra "Expirada" (por fecha) + botón renovar | ⬜ |
| 10.7 | Anamnesis **de equipo** vs individual | Cada tipo carga su plantilla (ver §17.4); equipo muestra además consentimiento de imagen y flujo de menor (§18) | ⬜ |

---

## 11. Documentos (VALD / imágenes)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 11.1 | Subir PDF a nivel paciente | Aparece en el paso 3 de la ficha | ⬜ |
| 11.2 | Subir imagen (caption + incluir-en-informe) | Aparece; caption guardado | ⬜ |
| 11.3 | Ver documento (signed URL) | Abre a través de URL firmada (1h) | ⬜ |
| 11.4 | Subir por **sesión** (§5.4) | `session_id` fijado | ⬜ |
| 11.5 | Borrar documento | Se elimina | ⬜ |

---

## 12. IA (transversal)

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 12.1 | Dictado por voz en exploración | Transcribe (OPENAI) | ⬜ |
| 12.2 | Informe individual sobre sesión con pruebas + VALD | El texto refleja notas + guías por prueba | ⬜ |
| 12.3 | Clasificación automática tras informe | Región/patología/actividad se rellenan (no bloquea si falla) | ⬜ |
| 12.4 | Parseo robusto | Si el modelo devuelve JSON válido, no hay 500 | ⬜ |

---

## 13. Seguridad / RLS / multi-tenant

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 13.1 | Aislamiento de clínica | Un usuario no ve pacientes/equipos/campañas/informes de otra clínica | ⬜ |
| 13.2 | Anamnesis: rol `anon` no lee anamnesis | (Verificable por MCP) 0 filas para anon | ⬜ |
| 13.3 | Rutas protegidas | Sin sesión no se accede (ver 1.5) | ⬜ |
| 13.4 | Advisors de Supabase | Sin ERRORES (solo warnings de hardening conocidos) | ⬜ |
| 13.5 | Acciones admin | reset-patients / invite solo admin | ⬜ |

---

## 14. Casos borde / negativos

| ID | Caso | Esperado | Estado |
|---|---|---|---|
| 14.1 | Paciente sin anamnesis / sin VALD → generar informe | Se genera igualmente | ⬜ |
| 14.2 | Campaña sin equipos / sin valorados | Avisos controlados (no 500) | ⬜ |
| 14.3 | CSV con fila sin nombre / email inválido | Fila marcada ❌, no se crea | ⬜ |
| 14.4 | Duplicado de email dentro del equipo / del fichero | Marcado duplicado, excluido por defecto | ⬜ |
| 14.5 | Sin API key (si aplicara) | 500 controlado con mensaje claro, no crash | ⬜ |
| 14.6 | Textos largos / caracteres raros en formularios | Se guardan sin romper | ⬜ |

---

## 15. Regresión crítica (resumen — lo que NO debe haberse roto)

- [ ] Flujo individual completo (§4) intacto tras todo el trabajo de equipos + rediseño UI.
- [ ] Informe individual (generar/editar/aprobar/PDF) independiente del de campaña.
- [ ] Documentos a nivel paciente siguen funcionando además de los de sesión.
- [ ] Deportes/pruebas/consentimientos configurables sin afectar al caso suelto.

---

## 16. Roles (admin vs fisioterapeuta) — NUEVO
> Probar con **dos cuentas**: un admin y un fisio (p. ej. `sergiociria2@gmail.com` es fisio).

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 16.1 | **Sidebar del fisio** | Solo Inicio·Estudios·Pacientes·Equipos·Ajustes (sin Informes ni Actividad) | ⬜ |
| 16.2 | Fisio entra por URL a `/reports` o `/activity` | Redirige a `/dashboard` | ⬜ |
| 16.3 | Fisio en **Ajustes** | Solo pestaña "Mi perfil"; URLs `/settings/{tests,sports,consents,anamnesis}` redirigen a `/dashboard` | ⬜ |
| 16.4 | Fisio en ficha de paciente | **No** ve "Eliminar paciente"; si forzara la API → 403 | ⬜ |
| 16.5 | Fisio en `/groups`, `/groups/[id]`, `/estudios`, `/teams/[id]` | **No** ve crear grupo/equipo/estudio ni importar; RLS bloquea la escritura directa | ⬜ |
| 16.6 | Fisio: **Añadir jugador** y **Valorar** | **Sí** puede (no bloqueado) | ⬜ |
| 16.7 | Fisio: visibilidad de usuarios | No ve a otros usuarios (Personal oculto; RLS `users` = self-or-admin) | ⬜ |
| 16.8 | **Admin**: ve todo | Informes, Actividad, todas las pestañas de Ajustes; puede crear estructura, config y usuarios | ⬜ |
| 16.9 | **Rol bajo el nombre** (sidebar, escritorio y móvil) | "Administrador" / "Fisioterapeuta" | ⬜ |
| 16.10 | **Inicio por defecto** | Abre en scope **Míos** (no toda la clínica); toggle a `?scope=clinic` | ⬜ |

---

## 17. Anamnesis: plantillas editables + tipos + exploración — NUEVO

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 17.1 | **Ajustes → Anamnesis** (admin) → `/settings/anamnesis` | Editor con dos pestañas: **Individuales** / **Equipos** | ⬜ |
| 17.2 | Editar/añadir/reordenar/eliminar **bloques y preguntas** (tipos, opciones, obligatoria) → Guardar → recargar | Persiste; el punto ámbar marca cambios sin guardar | ⬜ |
| 17.3 | **Restablecer por defecto** | Vuelve a la plantilla del código | ⬜ |
| 17.4 | **Render por audiencia**: abrir enlace de anamnesis de un **jugador de equipo** vs **individual** | Cada uno carga su plantilla; la de equipo = "Ficha del deportista" (datos, antropometría, lesiones, estado) | ⬜ |
| 17.5 | **Caducidad 14 días** + "Expirada" por fecha (ficha, alerta de Inicio, etapa en lista) + **Renovar** | Estado real reflejado; renovar genera enlace nuevo | ⬜ |
| 17.6 | **Ficha individual = hub** | Tarjeta Anamnesis + Historial de consultas; **sin** bloque "Proceso del paciente" de 5 pasos | ⬜ |
| 17.7 | **Exploración multi-región** (sesión individual) | Añadir varias zonas, progreso por región, quitar; datos previos de una zona se infieren y aparecen | ⬜ |

---

## 18. Consentimientos ampliados: imagen + menores — NUEVO
> Todo el flujo de **anamnesis de equipo** (jugador con `team_id`). El individual NO ve imagen ni, salvo declaración, menor.

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 18.1 | Anamnesis de **equipo** → pantalla de consentimientos | Aparece 4º bloque **"Derechos de imagen · opcional"** además de los 3 | ⬜ |
| 18.2 | Marcar imagen → elegir **canales** (Web, RRSS, material, eventos) → enviar | Traza en `consents` (type `image_rights`, granted, `metadata.channels`) | ⬜ |
| 18.3 | Imagen **no bloquea** | Se puede enviar sin marcarla (solo los 3 son obligatorios) | ⬜ |
| 18.4 | Anamnesis **individual** | **No** muestra el consentimiento de imagen | ⬜ |
| 18.5 | **Menor automático**: jugador con fecha nac. <18 | La casilla "menor de edad" aparece **marcada** por defecto | ⬜ |
| 18.6 | **Menor auto-declarado**: marcar la casilla manualmente | Se despliegan los campos del representante | ⬜ |
| 18.7 | Campos del **representante** (nombre*, DNI, relación*) | No deja continuar sin nombre + relación; título pasa a "otorgado por el representante legal" | ⬜ |
| 18.8 | Enviar como menor | `consents.metadata.representative`; ficha muestra "Menor · otorgados por su representante legal: … (relación) · DNI" | ⬜ |
| 18.9 | **Persistencia**: rellenar representante, recargar el formulario | Los datos siguen ahí (autoguardado en `form_data`) | ⬜ |
| 18.10 | **Ajustes → Consentimientos** | 4 textos editables (incl. Derechos de imagen, ya con texto base) | ⬜ |

---

## 19. Consulta (sesión) distinta por tipo de paciente — NUEVO

| ID | Caso / pasos | Resultado esperado | Estado |
|---|---|---|---|
| 19.1 | Consulta **de estudio** (creada desde el bloque del estudio) | **Sin** Exploración, **sin** Ecografías/fotos, **sin** selector de Deporte; **con** contexto Estudio·Grupo·Equipo arriba | ⬜ |
| 19.2 | Consulta de estudio · Pruebas | Dirigidas por el **deporte** (SessionTestsPanel); notas por prueba | ⬜ |
| 19.3 | Consulta **individual** (incluso de un jugador de equipo, desde "Consultas individuales") | **Con** Exploración (multi-región), **con** Ecografías/fotos, **sin** deporte, pruebas del **catálogo** — igual que un paciente sin equipo | ⬜ |
| 19.7 | El patrón lo decide `campaign_id` de la consulta, **no** el `team_id` del paciente | Un jugador de equipo puede tener consultas de estudio (patrón equipo) e individuales (patrón individual) a la vez | ⬜ |
| 19.4 | Individual · Pruebas del **catálogo** | Checklist de todas las pruebas; marcar crea `session_test` + notas; desmarcar la elimina | ⬜ |
| 19.5 | **Anotaciones generales del fisio** (ambos tipos) | Se guardan en `sessions.notes` y llegan al contexto del informe | ⬜ |
| 19.6 | **Numeración** de secciones | Sin huecos según el tipo (equipo 5 secciones, individual 7) | ⬜ |

---

## Datos de prueba recomendados (para un recorrido completo)
1. **Grupo** "Club de Pruebas" → **Equipo** "Equipo A" con **deporte** (con 2 pruebas mapeadas).
2. **3 jugadores** en Equipo A (1 por alta manual, 2 por CSV) + **1 paciente individual** suelto.
3. **Campaña** "Pretemporada test" sobre el grupo con Equipo A, 2 seguimientos.
4. Valorar 2 jugadores (1 con VALD + notas por prueba) → generar **informe individual** y **de campaña**.
5. Enviar y completar **1 anamnesis** (paciente individual).

## Registro de incidencias
| Fecha | Caso | Descripción | Severidad | Estado |
|---|---|---|---|---|
|  |  |  |  |  |

## Automatización (futuro, opcional)
- Sin framework de tests hoy. Candidatos: **Playwright** (E2E de los flujos §4/§8/§9) + **Vitest** para utils puros (`rosterImport`, `stage`, `sport`, `consents`). CI en GitHub Actions con build + typecheck en cada push.
- Prioridad si se aborda: E2E del **flujo individual** (regresión) y del **flujo de campaña**.

---

## Qué puedo verificar yo (automatizable ahora, sin UI)
- `npm run build` (compila + typecheck).
- Vía MCP `supabase-sherpa` (solo lectura): estado de tablas/policies, **advisors de seguridad** (§13.4), conteos de datos, y comprobaciones de RLS (p. ej. §13.2).
- Revisión de código de rutas/flows concretos.
> Dímelo y ejecuto estas comprobaciones para cubrir las suites 13 (parcial) y 0.2 mientras tú recorres la UI.
