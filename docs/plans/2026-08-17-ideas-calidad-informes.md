# Ideas para mejorar la CALIDAD/PROFUNDIDAD de los informes IA

**Fecha:** 2026-08-17 · **Estado:** aparcado (retomar más adelante)

## Contexto

Hoy el informe (individual/deportista y de estudio) se genera con **una sola llamada** a
Claude Sonnet 5, que a la vez **lee los PDF de VALD por visión Y redacta** el informe.
Esa llamada única es la raíz de los fallos que hemos ido corrigiendo a mano:
percentiles mal atribuidos, confundir métricas al leer gráficas, aritmética de asimetrías.

Estas son ideas para subir la calidad **con más complejidad que una sola llamada**.
Ordenadas por valor/encaje con la arquitectura actual. No hay nada implementado.

---

## Las 3 prioritarias

### 1. Pipeline en 2 fases: extraer primero, redactar después ⭐ (la de más valor)
Separar la lectura de datos de la redacción:
- **Fase 1 — Extracción:** una llamada centrada SOLO en leer los PDF de VALD y devolver
  **números estructurados** (por prueba: valor por lado, asimetría %, percentil) en JSON
  estricto. Poca creatividad, máxima precisión. **Se guardan en `session_tests.result_data`**
  (la capa de métricas que ya existe en la app).
- **Entre fases (código):** recalcular asimetrías/ratios, validar rangos y marcar prioridades
  en **código** (los LLM son malos con aritmética). El modelo *interpreta*, no *calcula*.
- **Fase 2 — Redacción:** la llamada narrativa recibe esos números **ya limpios como texto** +
  notas + anamnesis, y escribe SIN tener que leer gráficas → menos carga, menos errores.
- **Bonus:** al quitar la carga de visión de la fase 2, esa llamada puede subir el `effort`
  (o incluso usar un modelo mayor) sin riesgo de truncarse.

**Ataca directamente** los bugs de datos que ya sufrimos. Reutiliza `session_tests.result_data`
y `computeTeamMetrics`.

### 2. Pasada de "revisor clínico" (generar → revisar → corregir)
Tras el borrador, una **segunda llamada con contexto fresco** hace de revisor y comprueba
contra los datos: coherencia numérica, tren superior/inferior, magnitud de percentiles, que
no se inventa nada, y estilo (sin paréntesis, sin solape). Devuelve una lista de fallos que se
aplican. Cazaría la clase de bugs que llevamos arreglando a mano. Coste: +1-2 llamadas.

### 3. Set de referencia + eval automático ⭐ (el meta-truco)
Montar 5-10 casos con informe "bueno conocido" (Carla, etc.) y un **evaluador automático**
(Claude de juez) que puntúe cada informe nuevo en: precisión vs VALD, estilo, no-solape. Así,
al cambiar el prompt **medimos** si mejora en vez de mirarlo a ojo. Es lo que hace seguras y
medibles todas las demás mejoras.

---

## Otras palancas (menor esfuerzo o más nicho)

- **Modelos por fase:** Haiku/medium para extraer (mecánico, barato) + Sonnet high/Opus para
  redactar (donde importa la calidad). Tiered.
- **Grounding con baremos y ejemplares:** adjuntar valores normativos por prueba/deporte/
  posición (ya existe `sport_references`) + **un informe ejemplar aprobado** como ancla de
  estilo (few-shot). El percentil se interpreta con referencia real, no "a ojo".
- **Salida estructurada (JSON schema):** `output_config.format` para blindar la estructura
  (adiós fallos de parseo) y poder limitar longitud por campo. (No arregla truncación.)
- **Aprender de las ediciones del fisio:** guardar el *diff* entre borrador y aprobado y
  destilar las correcciones recurrentes al prompt. Convierte retoques manuales en mejora
  sistemática.
- **Descomposición por roles / multi-agente:** lector (extrae) + clínico (interpreta por área)
  + editor (estilo + de-dup). Potente pero probablemente overkill por ahora.

---

## Recomendación

Empezar por **1 (pipeline 2 fases) + 3 (eval)**: la 1 ataca la raíz de los errores de datos y
reutiliza la capa de métricas existente; la 3 da forma objetiva de saber si mejora. La 2
(revisor) se añade después si aún se cuela algo.

**Trade-off:** más llamadas → más coste y tiempo por informe. Pero como ya generamos **en
segundo plano**, la latencia no molesta al usuario y el coste sigue siendo de céntimos.

**Antes de implementar:** pasar por el super-brainstorm para diseñar el pipeline (formato del
JSON de extracción, dónde valida el código, qué modelo por fase, cómo encaja con
`session_tests.result_data` y con el flujo de segundo plano actual).
