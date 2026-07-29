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

### Etapa 2 — Inicio (dashboard) refinado *(siguiente)*
- Añadir al dashboard: **Estudios activos** (tarjetas con progreso) + **Consultas recientes** + conmutador **Clínica / Míos**. Reutiliza queries existentes; reskin ligero.

### Etapa 3 — Historial del paciente (timeline) *(pendiente)*
- Convertir la ficha `/patients/[id]` (o una sección) en **línea temporal de consultas** (valoración → seguimientos, con estado e informe). 100% construible con `sessions`.

### Etapa 4 — Refinamiento visual progresivo *(pendiente)*
- Componentes compartidos (KPI tiles, study cards, status pills, timeline) y aplicación pantalla por pantalla. Sin big-bang.

### Etapa 5 — Agenda / entidad "cita" *(fase propia, con diseño de datos)*
- Modelar `appointments` (o similar) y construir la vista Agenda (día/semana, estados). Decidido aparte.

## Notas
- Estilo con el vocabulario Tailwind ya presente (azul/gris, rounded-2xl, píldoras) + `tabular-nums` para datos; el gold del "Método Podium™" se reserva para lo de marca.
- Prototipos de referencia: artifacts v1 y v2 (este último con los tokens del design system de Stitch). El MCP de Stitch (`stitch`, scope local) permite releer el proyecto "Podium Clinical Management System" (`projects/7125105597317803896`).
