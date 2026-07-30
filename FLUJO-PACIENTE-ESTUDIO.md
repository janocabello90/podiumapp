# Flujo de paciente en estudio (session-centric) — plan

> Resuelve la incoherencia de "dos interfaces" en pacientes de equipo/estudio y ordena el recorrido Estudio → Equipo → Paciente → Sesiones.
> **Decisiones confirmadas (usuario):** (1) **solo estudio/equipo** — el paciente individual sin equipo NO se toca; (2) anamnesis obligatoria pero **aviso no bloqueante**; (3) **secciones por equipo** dentro del estudio (sin drill-down a páginas de equipo).

## Diagnóstico
La ficha `/patients/[id]` mezcla dos modelos: el **nuevo** (timeline de sesiones + "Valorar" que abre el *stepper* de sesión) y el **viejo** ("Proceso del paciente" de 5 pasos, residuo pre-sesiones). Por eso, pulsar el nombre lleva a un sitio y "Valorar" a otro. El trabajo real ya vive en el **stepper de sesión** (Fase D/F): anamnesis-contexto · exploración · pruebas · VALD · imágenes · informe.

## Modelo objetivo
**`/patients/[id]` adaptativa según `team_id`:**
- **Con equipo (estudio) → HUB centrado en sesiones** (nuevo layout):
  1. Cabecera + contexto (migas Estudio/Equipo si aplica).
  2. **Anamnesis (obligatoria, no bloqueante):** estado prominente; si falta → aviso + "Enviar enlace" (WhatsApp/copiar). Una por paciente.
  3. **Sesiones:** lista de consultas (timeline). Si no hay → **"Crear sesión"**; si hay → abrir/continuar. Cada sesión abre el stepper (único taller).
  4. Datos del paciente + equipo/deporte.
  5. **Se retira el "Proceso del paciente" de 5 pasos** para estos pacientes (su contenido ya está en el stepper).
- **Sin equipo (individual) → ficha actual de 5 pasos INTACTA.**

Así el paciente de equipo se ve igual entres por donde entres (estudio o lista de Pacientes), y el individual no cambia.

## Navegación del estudio (secciones por equipo)
`/estudios/[id]` mantiene las **secciones por equipo** (como ahora, mejoradas): cada jugador muestra estado de **anamnesis** y de **sesión en el estudio** (valorado/en curso/sin valorar); **clic en el jugador → su hub** (session-centric). El botón "Valorar" del roster deja de divergir: o lleva al hub, o crea sesión + abre stepper como atajo (el hub sigue siendo el sitio canónico).

## Anamnesis (no bloqueante)
- En el hub, tarjeta/banner de anamnesis: "Completada / Pendiente / Sin iniciar".
- Si falta: aviso claro + acción "Enviar enlace". No impide crear/rellenar sesiones (el fisio puede valorar igual; la anamnesis suele llegar async).
- (Futuro opcional) envío de anamnesis en lote a todo un equipo; rellenado por el fisio en consulta.

## Plan por fases
- **F1 — Hub session-centric para pacientes de equipo.** `/patients/[id]`: si `team_id` != null, render hub (anamnesis + sesiones + datos); si null, ficha actual. Reutiliza el timeline ya existente y `StartSessionButton`. Aviso de anamnesis no bloqueante.
- **F2 — Secciones por equipo en el estudio.** Mejorar el roster del estudio: por jugador, estado de anamnesis + estado de sesión en el estudio; clic → hub; reconciliar el botón "Valorar".
- **F3 (menor) — Consolidación.** Documentos/informe a nivel sesión como camino principal para pacientes de equipo (el nivel-paciente queda de respaldo). Sin migración destructiva.

## Notas técnicas
- **Sin migración de BBDD** (usa `patients.team_id`, `sessions`, `anamnesis_forms` existentes).
- El stepper de sesión ya existe y se reutiliza tal cual.
- Sesiones del hub: se muestran todas las del paciente; las del estudio van etiquetadas; "Nueva sesión" desde el estudio la crea con `campaign_id`.
- Riesgo: bajo/medio — es reordenar UI del paciente de equipo; el individual y el stepper no se tocan.

## Decisiones ya tomadas
1. Alcance: **solo pacientes con equipo** (individual intacto).
2. Anamnesis: **aviso visible, no bloquea**.
3. Navegación: **secciones por equipo** en el estudio (sin drill-down).

## Registro
- **F1 — HECHA (2026-07-30).** `/patients/[id]` adaptativa por `team_id`. Paciente de equipo → hub: tarjeta **Anamnesis** (estado Completada/Pendiente + aviso no bloqueante + `AnamnesisActions` para enviar/generar enlace) + **Historial de consultas** (timeline, con estado vacío "Crea la primera con «Nueva consulta»"). **Se retira el "Proceso del paciente" de 5 pasos** para pacientes de equipo (`{!isTeamPatient && ...}`). Paciente sin equipo → ficha clásica intacta.
- **F2 — HECHA (2026-07-30).** En `/estudios/[id]`, cada jugador del roster muestra estado de **sesión** (Sin valorar / N sesiones) y **anamnesis pendiente** (chip ámbar); el nombre enlaza al hub del paciente. Se conserva el botón "Valorar/Seguimiento" como atajo (crea sesión + abre stepper).
- **F3 — cubierta por F1.** Al quitar el workflow del hub, los pacientes de equipo trabajan documentos/informe **por sesión** (stepper Fase F); el nivel-paciente ya no se muestra para ellos. Sin migración ni borrado (los datos previos siguen accesibles vía sesión/BBDD).

**Completado.** Sin migración de BBDD; el flujo individual (sin equipo) y el stepper de sesión no se han tocado.
