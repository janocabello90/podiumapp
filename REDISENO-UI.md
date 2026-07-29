# Rediseño de UI — de prototipo a app real

> Iniciativa posterior al flujo de equipos A–H. Objetivo: llevar a la app la **arquitectura de navegación** y el **lenguaje visual** validados en los prototipos (v1 propio + design system del proyecto Stitch "Podium Clinical Management System").
> **Principio:** progresivo y sin regresión. Se refina **pantalla por pantalla**; lo existente sigue funcionando. La app es **light-only** por ahora (el prototipo tenía dark; el dark app-wide es fase aparte).
> **Fuera de alcance inicial:** la **Agenda/citas** (necesita modelar la entidad "cita": fecha/hora + estado programada/en sala/completada, ligada a paciente y opcionalmente a la sesión). Se hará en su propia fase, decidido con el usuario.

## Decisiones de producto (confirmadas)
- Arquitectura de dos mundos: **Estudios** (campañas de equipo) y **Pacientes** (individuales), cada uno con su recorrido hasta las **consultas** (= sesiones).
- Sidebar: Inicio · Estudios · Pacientes · Equipos · (Informes · Actividad) · Configuración. *(Agenda entra cuando se implemente.)*
- **Inicio = toda la clínica**, con conmutador "Clínica / Míos" (pendiente, etapa de dashboard).
- **Citas = historial de consultas** (líneas temporales sobre las sesiones existentes); la agenda de citas futuras es fase posterior pero **sí se hará**.
- **Sin datos inventados**: no montar UI que prometa métricas que el modelo no captura (p. ej. Readiness/VAS). Si se quieren, se modelan antes.
- Lenguaje visual: azul clínico + oro "Método Podium™" contenido, slate frío, datos con `tabular-nums`/mono, tarjetas redondeadas, píldoras de estado, barras finas. (Coincide con lo que la app ya hacía; se formaliza y refina.)

## Etapas
### Etapa 1 — Estudios de primer nivel + navegación (HECHA 2026-07-29)
- **Nueva página `/campaigns` (Estudios)**: lista de campañas de la clínica (Activos / Finalizados) con **progreso real** (valorados/total, calculado desde `campaign_teams` → jugadores del equipo × sesiones de la campaña), equipos, fechas, estado; enlaza al detalle `/campaigns/[id]` (ya existente). Cero regresión (página nueva).
- **Sidebar**: añadida entrada **"Estudios"** (`/campaigns`, icono Megaphone) y reordenado a Inicio · Estudios · Pacientes · Equipos · Informes · Actividad · Ajustes. La bottom-nav móvil muestra las 4 primeras.
- Resuelve el "entrar y ver los estudios activos" que faltaba (antes las campañas solo se veían dentro de `/groups/[id]`).

### Etapa 2 — Inicio (dashboard) refinado (HECHA 2026-07-29)
- **Conmutador Clínica / Míos** (vía `?scope=mine`, server-side): "Toda la clínica" por defecto; "Míos" filtra por el fisio (created_by / assessment.physio_id / report.generated_by, y sesiones por physio_id).
- **KPIs nuevos** (scope-aware): Estudios activos (→/campaigns) · Consultas · 7 días (sesiones) · Informes por revisar (drafts) · Pacientes activos (→/patients).
- **Estudios activos**: tarjetas de campañas activas con progreso real (valorados/total), enlazando al detalle.
- **Consultas recientes**: últimas sesiones (paciente + tipo valoración/seguimiento + estado en curso/completada + fecha), enlazan a la página de sesión.
- **Conservado**: Alertas (anamnesis expirada / valoración estancada / borrador sin aprobar) y Distribución por etapa, ahora **scope-aware**. Se retiró el bloque placeholder "Seguimiento — Próximamente".

### Etapa 3 — Historial del paciente (timeline) (HECHA 2026-07-29)
- Nueva tarjeta **"Historial de consultas"** (primera del bloque principal en `/patients/[id]`): timeline de todas las `sessions` (más reciente arriba) con tipo (Valoración inicial / Seguimiento N), fecha, estado (En curso/Completada), enlace **Abrir consulta** (→ página de sesión) y enlace al **informe** de esa sesión si existe (`reportBySession` por `reports.session_id`). Botón "Nueva consulta" en la cabecera.
- Aditivo: el "Proceso del paciente" (workflow de 5 pasos) y el rail derecho se conservan intactos. Resuelve el "ver las consultas y su seguimiento" (antes solo se veía la última sesión + un "N sesiones" suelto).

### Etapa 4 — Refinamiento visual (EN CURSO)
**4a — Base tipográfica y de color (HECHA 2026-07-29):**
- **Fuentes** de Stitch adoptadas vía `next/font`: **Inter** (`--font-sans`, UI) + **JetBrains Mono** (`--font-mono`, datos). Configuradas en `tailwind.config` (`fontFamily.sans/mono`) y `layout.tsx`. Antes: stack de sistema.
- **Fondo** `#faf8ff` (token `clinical-bg`) en lugar de `gray-50`; tokens `clinical.*` (primary `#0f52ba`, navy `#003c90`, gold `#9a7726`, soft `#d9e2ff`) en Tailwind + CSS vars para adopción progresiva.
- **Sidebar**: subtítulo "Método Podium™" en oro; estado activo con `clinical-soft`/`clinical-navy`.
**4b — Unificación de color + datos (HECHA 2026-07-29):**
- **Azul de marca unificado a la paleta clínica** en toda la app (mecánico, ~22 ficheros): `bg-blue-900`→`bg-clinical-primary` (#0f52ba), `hover:bg-blue-800`→`hover:bg-clinical-navy`, `text-blue-900`→`text-clinical-navy`, `to-blue-900`→`to-clinical-navy`. Botones primarios, logo y estados activos ahora en el azul de Stitch.
- **JetBrains Mono en datos** clave (contadores de progreso valorados/total, fechas) en Inicio y Estudios.
**4c — Pendiente (opcional):** enriquecer los rails (informe IA del estudio con preview + acción sugerida; cockpit del paciente) y homogeneizar study cards / KPI tiles / pills en pantallas legacy (settings, anamnesis).

### Etapa 5 — Agenda / entidad "cita" *(fase propia, con diseño de datos)*
- Modelar `appointments` (o similar) y construir la vista Agenda (día/semana, estados). Decidido aparte.

## Notas
- Estilo con el vocabulario Tailwind ya presente (azul/gris, rounded-2xl, píldoras) + `tabular-nums` para datos; el gold del "Método Podium™" se reserva para lo de marca.
- Prototipos de referencia: artifacts v1 y v2 (este último con los tokens del design system de Stitch). El MCP de Stitch (`stitch`, scope local) permite releer el proyecto "Podium Clinical Management System" (`projects/7125105597317803896`).
