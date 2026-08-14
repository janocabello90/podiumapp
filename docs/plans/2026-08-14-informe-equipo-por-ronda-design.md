# Informe de equipo por ronda (agregado de estudio) — Diseño

**Fecha:** 2026-08-14
**Estado:** diseño aprobado (pendiente de implementación)
**Ámbito:** flujo de equipos (estudios/campañas). El caso individual se conserva; solo se le añade la capa de datos objetivos.

---

## 1. Resumen

Hoy el informe agregado (Fase G) genera **un único documento para todo el estudio**, cualitativo, leyendo datos de sesión en crudo. Este diseño lo sustituye por un **informe agregado por `(equipo, ronda)`**, apoyado en dos capas:

1. **Interpretación** — los informes individuales ya generados y **aprobados** (cualitativo).
2. **Datos objetivos** — una "hoja de métricas" por prueba (cifras: izq/der/asimetría/percentil), **nueva**, que la IA extrae del VALD al generar el individual, el fisio valida, y se guarda para poder agregarse.

El informe de equipo **lee las dos capas**: calcula la parte cuantitativa en código (medias, rangos, outliers — sin que la IA invente cifras) y sintetiza la cualitativa con IA. Se genera **por ronda de consultas**: cuando todos los jugadores incluidos de un equipo tienen su individual de esa ronda aprobado.

## 2. Objetivos y no-objetivos

**Objetivos**
- Un informe de equipo **por equipo y por ronda**, no uno global de estudio.
- Que sea **coherente con los individuales** (se nutre de ellos) y **cuantitativo** (cifras reales agregadas).
- Añadir al individual **solo** la capa de datos objetivos (mínimo necesario).

**No-objetivos (YAGNI, por ahora)**
- El **rediseño narrativo del individual** (feedback de los fisios: acortar, quitar paréntesis, reestructurar, semáforo…) → workstream aparte y posterior.
- **Informe de evolución** entre rondas (comparar ronda 1 vs 2).
- **Vista de estudio/club global** (Opción C).
- Tabla persistente de exclusiones (v1 las guarda en el propio informe).
- Integración con API de VALD (no existe; las cifras se extraen del PDF).

## 3. Decisiones (log)

| # | Decisión | Elegido |
|---|----------|---------|
| 1 | Unidad del informe agregado | **Por equipo** (no por estudio) |
| 2 | De qué se nutre | **De los informes individuales** (interpretación) + capa de datos objetivos |
| 3 | Origen de las cifras objetivas | **IA las extrae del VALD**, editables por el fisio |
| 4 | Visibilidad de la hoja de métricas | En la **pantalla de revisión** del individual; **no** en el PDF por defecto (toggle para incluir) |
| 5 | Qué métricas se extraen | **Métricas clave definidas por prueba** (config en `tests.result_schema`) |
| 6 | Gating del informe de equipo | Todos los jugadores **incluidos** deben tener el individual de esa ronda **APROBADO**; opción de **excluir** jugadores |
| 7 | Unidad temporal | **Por ronda de consultas** `(equipo, ronda)` |
| 8 | Cuantitativo del informe de equipo | **Calculado en código** (la IA no inventa medias) |
| 9 | Alcance en el individual | Solo se añade la capa de datos objetivos; el rediseño narrativo es posterior |

## 4. Arquitectura

```
CAPA 1 · INTERPRETACIÓN (existe)   → informe individual, 1 por (jugador, sesión). Se conserva; se le cuelga la Capa 2.
CAPA 2 · DATOS OBJETIVOS (nueva)   → cifras por prueba; IA extrae del VALD, fisio valida; en session_tests.result_data.
INFORME DE EQUIPO (nuevo)          → 1 por (equipo, ronda). Lee Capa 2 (cuant) + Capa 1 (cual).
ESTUDIO                            → contenedor (varios equipos, varias rondas, roster, progreso).
```

Flujo temporal: valorar (ronda N) → generar+revisar+**aprobar** cada individual (con su hoja de métricas validada) → cuando el equipo está completo (o excluidos los que falten) → **generar informe de equipo de la ronda N**. Repetible por ronda.

## 5. Modelo de datos

Cambios aditivos (nada rompe lo actual). Vía **MCP `apply_migration`** + regenerar `types/database.generated.ts`.

### 5.1 `tests.result_schema` (JSONB, ya existe) — métricas clave por prueba
Define el fisio, una vez por prueba (Ajustes → Deportes y pruebas). Forma orientativa:
```json
{ "metrics": [
  { "key": "altura_salto", "label": "Altura de salto", "unit": "cm", "bilateral": true, "percentil": true },
  { "key": "asimetria",    "label": "Asimetría",        "unit": "%",  "bilateral": false }
]}
```

### 5.2 `session_tests.result_data` (JSONB, ya existe) — cifras extraídas
```json
{ "altura_salto": { "izq": 4.6, "der": 7.2, "pct_izq": 8, "pct_der": 27 },
  "asimetria":    { "valor": 37, "lado": "der" },
  "_meta": { "fuente": "ia", "revisado": true } }
```
`revisado` marca si el fisio ya validó (para el aviso en la UI). Valores no leídos → `null` (la agregación los ignora).

### 5.3 `sessions.campaign_round` (columna nueva · int · nullable)
`session_number` es contador de por vida del jugador, no sirve como ronda. Al crear sesión con `campaign_id`, se calcula `campaign_round = (nº de sesiones de ese jugador en ese estudio) + 1`. Sesiones fuera de estudio → `null`.

### 5.4 `reports` — columnas nuevas + CHECK
- `team_id uuid` (FK `teams`, ON DELETE SET NULL)
- `campaign_round int`
- **CHECK de coherencia:**
  - `scope='individual'` ⇒ `patient_id` + `session_id`
  - `scope='campaign'` (informe de equipo) ⇒ `campaign_id` + `team_id` + `campaign_round`; `patient_id` null
- **Sin unique** en `(campaign_id, team_id, campaign_round)`: se permiten varios borradores y se usa el **último** por fecha (mismo patrón que el individual).

### 5.5 Exclusiones (v1, sin tabla)
Se eligen en la UI al generar y se guardan en `report_data._meta.incluidos / excluidos` (+ motivo opcional). Al regenerar una ronda, se **predefinen** con las del último informe de esa ronda.

### 5.6 RLS
`reports` y `sessions` ya son clínica-scoped → las columnas nuevas heredan RLS sin policies nuevas. `tests.result_schema` y `session_tests.result_data` ya existen con su RLS.

## 6. Capa de métricas

### 6.1 Extracción (al generar el individual)
El generador del individual ya envía los PDF de VALD a la IA. Se le añade un segundo encargo: **rellenar las métricas clave** de cada prueba según su `result_schema`.
- La IA devuelve, junto a la narrativa, un bloque de métricas por prueba. Se guarda: narrativa → `reports.report_data`; métricas → `session_tests.result_data` (una fila por prueba).
- Solo se extrae de pruebas con `result_schema` definido (degradación limpia: sin config, no hay métricas y el equipo agrega solo cualitativo).
- Una sola llamada IA (sin coste extra apreciable; solo algo más de salida).

### 6.2 Validación (pantalla de revisión del individual)
Nueva sección **"Datos objetivos (VALD)"** en el editor del informe:
- Tabla por prueba (izq/der/asimetría/percentil), **editable celda a celda**. Guardar → `result_data` + `_meta.revisado = true`.
- Aviso: *"Estos datos NO se incluyen en el PDF (alimentan el informe de equipo)"* + toggle **"Incluir en el PDF"** (`report_data._meta.include_metrics_in_pdf`).
- Aviso suave si hay celdas sin revisar antes de aprobar.
- **Aprobar el individual** = métricas validadas (gate del informe de equipo).

### 6.3 PDF individual
Por defecto sin métricas. Si el toggle está ON, el exportador individual añade un **anexo** con la tabla de métricas.

### 6.4 Fiabilidad
La IA puede tener deslices al leer. Mitigación en capas: (1) regla de percentiles/magnitudes ya en el prompt; (2) el fisio revisa/corrige en 6.2; (3) solo entran al equipo individuales **aprobados**. Ningún dato sin revisar se agrega a espaldas del fisio.

## 7. Generación del informe de equipo

### 7.1 Endpoint
Refactor de `/api/reports/campaign-generate` a `(campaignId, teamId, round, excluidos[])`.

### 7.2 Gating (servidor)
1. Roster del equipo `team_id`.
2. Sesión de ronda N de cada jugador (`campaign_id` + `campaign_round = N`).
3. Cada jugador **incluido** debe tener su individual de esa sesión **APROBADO**; si falta alguno → error con nombres. Excluidos se saltan.

### 7.3 Agregación — dos capas
- **Cuantitativo = calculado en código** (no IA) desde `session_tests.result_data` validado: media, min–max, nº por encima de umbral, outliers por métrica. Sin cifras inventadas.
- **Cualitativo = IA**: se le pasan las estadísticas ya calculadas + los titulares de cada individual; redacta patrones, fortalezas, a-vigilar y recomendaciones alrededor de esos números. Privacidad: tokens `[[JUGADOR_n]]`, restituidos al final.

### 7.4 Estructura `report_data` (propia; no calca el individual)
```
1. portada           equipo · estudio · ronda · cobertura (incluidos/excluidos) · fecha
2. resumen_equipo    (cual)
3. panel_metricas    (CUANT, calculado) por prueba: media · min–max · nº sobre umbral · outliers[{jugador,valor}]
4. patrones_y_riesgos (cual)
5. fortalezas        (cual)
6. jugadores_a_vigilar (cual) [{nombre, motivo}] → remite al individual
7. recomendaciones   (cual)
8. descargo          (fijo)
_meta: incluidos, excluidos, cobertura, ronda, umbrales
```

### 7.5 Umbrales
Configurables (enlaza con el semáforo, pendiente de los fisios). v1 con defaults: asimetría >15% se marca; percentil <30 se marca.

## 8. UI

### 8.1 Página del estudio `/estudios/[id]` — un bloque por equipo
Se retira la tarjeta única "Informe de estudio". Por cada equipo del estudio, una tarjeta con:
- Cobertura de la ronda (incluidos aprobados / incluidos).
- Lista de jugadores con **estado por ronda** (Aprobado / Borrador / Sin valorar), **toggle incluir/excluir** y enlace a su individual. Default: incluido si aprobado.
- Botón **"Generar informe de equipo · Ronda N"**, activo solo si todos los incluidos están aprobados (gating de 7.2, en vivo).
- **Historial**: informes de equipo ya generados, por ronda (estado + fecha + Revisar).

Reutiliza `StudyRoster` (agrupación por equipo, estado por jugador, envío masivo de anamnesis), con el bloque de informe encima.

### 8.2 Revisión del informe de equipo
Ruta `(estudio, equipo, ronda)` (p. ej. `/estudios/[id]/equipos/[teamId]/report?round=N`). Adapta `CampaignReportView`:
- **Panel de métricas** (cuantitativo): mostrado **calculado, solo lectura**.
- **Secciones cualitativas**: editables.
- **Aprobar** + **Exportar PDF** (`export-pdf-campaign` adaptado a la estructura por equipo, con el panel de métricas).

### 8.3 Se retira
La tarjeta única de informe de estudio y `/estudios/[id]/report`. En producción no hay informes de estudio guardados → reemplazo limpio.

### 8.4 Roles
El fisio genera/revisa/aprueba (individuales y de equipo), como hoy. Flag opcional para restringir la generación del de equipo a admin (trivial, no v1 salvo petición).

## 9. Migración y alcance

- Cambios de esquema **aditivos**; sin migración de datos (no hay informes de estudio en prod).
- El flujo antiguo (campaign-generate global, tarjeta única, `/estudios/[id]/report`) se **reemplaza** por el de equipo.
- El caso **individual** se conserva; solo se le añade la sección de datos objetivos (Capa 2).

## 10. Dependencias y pendientes (externos a este diseño)

- **Métricas clave por prueba** (`tests.result_schema`): las definen los fisios; sin ellas, la capa cuantitativa queda vacía y el de equipo agrega solo cualitativo. Enlaza con el punto de Héctor.
- **Lista definitiva de pruebas de balonmano**: pendiente de los fisios (afecta a qué pruebas → qué métricas).
- **Umbrales / semáforo**: valores exactos pendientes de los fisios; v1 con defaults.
- **Rediseño narrativo del individual**: workstream aparte; este diseño no lo bloquea (el de equipo lee el `report_data` del individual sea cual sea su forma).

## 11. Fases de implementación (alto nivel)

- **P1** — Migración de esquema (columnas de 5.3/5.4) + regenerar tipos.
- **P2** — Capa de métricas: extracción en la generación del individual + sección "Datos objetivos" en revisión + toggle/anexo PDF.
- **P3** — Config de `result_schema` (métricas clave por prueba) en Ajustes → Deportes y pruebas.
- **P4** — Informe de equipo: refactor de `campaign-generate` a `(equipo, ronda)`, gating, cálculo cuantitativo + síntesis cualitativa, estructura `report_data`.
- **P5** — UI: página del estudio (tarjetas por equipo, exclusiones, historial por ronda) + revisión del informe de equipo + PDF por equipo.
- **P6** — Retirar el informe único de estudio.

Orden recomendado: P1 → P2/P3 (capa de métricas end-to-end en el individual) → P4 → P5 → P6. P2 y P3 pueden validarse con los fisios antes de seguir.
