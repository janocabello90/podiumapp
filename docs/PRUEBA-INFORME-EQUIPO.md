# Prueba end-to-end · Informe de equipo por ronda

Guion para probar el flujo nuevo (capa de métricas + informe de equipo) con datos reales.
Retomable en cualquier momento. Tiempo estimado: ~10 min.

## Datos de la prueba
- **Estudio:** `Prueba Estudio Balonmano` → `/estudios/f9763971-fccf-40ea-9541-a658232ef503`
- **Equipo:** `Cadiz Balonmano`
- **Jugadora:** `Carla Soriano Jimenez` → informe en `/patients/45d9dbb1-d5e9-474b-bc34-d4b0c68ec657/report`
- Ronda: **1**. Carla es la única del equipo → el informe saldrá con **n=1** (normal para un smoke test).

## Prerequisitos (ya hechos ✅)
- Las **22 pruebas** de balonmano ya tienen **métricas clave** definidas (Ajustes → Deportes y pruebas).
- El código nuevo está **desplegado** en producción.

> Nota: el informe individual de Carla se generó **antes** de existir las métricas, así que sus
> "Datos objetivos" están **vacíos** → en el paso 1 los rellenas a mano (es justo el caso "el fisio
> valida"). Si quisieras probar la **extracción automática** por IA, habría que **regenerar** su
> individual (cuesta ~0,45 € y sobrescribe el informe pulido) — **no hace falta** para esta prueba.

---

## Pasos

### 1) Rellenar los "Datos objetivos" de Carla
1. Abre `/patients/45d9dbb1-d5e9-474b-bc34-d4b0c68ec657/report`.
2. Baja hasta la sección **"Datos objetivos (VALD)"** (aparece porque sus pruebas ya tienen métricas).
3. Verás una tabla por prueba con celdas vacías. **Mete algunos números** (con 3-4 pruebas basta, p. ej. CMJ, SLCMJ, Fuerza Q60º). Los valores reales están en los PDF de VALD de Carla, pero para el test valen números de ejemplo.
4. En cada prueba que edites, pulsa **Guardar** (la marca pasa a "revisado").

✔️ **Comprobar:** al recargar, los valores siguen ahí (se guardan en `session_tests.result_data`).

### 2) Aprobar el informe individual de Carla
1. En la misma pantalla, arriba, pulsa **Aprobar**.
2. El informe queda **bloqueado** (solo lectura) — es lo que exige el informe de equipo.

✔️ **Comprobar:** el estado cambia a "Aprobado".

### 3) Generar el informe de equipo
1. Ve al estudio: `/estudios/f9763971-fccf-40ea-9541-a658232ef503`.
2. En la sección **"Informes de equipo (IA)"** → tarjeta **"Cadiz Balonmano"**.
3. Carla debe aparecer **✅ Aprobado**. El botón **"Generar informe · Ronda 1"** debe estar **activo**.
   - Si estuviera bloqueado: es que hay algún jugador incluido sin aprobar → apruébalo o **desmárcalo** (checkbox).
4. Pulsa **Generar** (tarda ~30-90s). Al terminar te lleva a la revisión.

✔️ **Comprobar:** aparece la fila del informe de equipo (borrador) + te redirige a `/estudios/…/report?team=…&round=1`.

### 4) Revisar y exportar
1. En la revisión verás:
   - Cabecera: **Equipo · Estudio · Ronda · Cobertura**.
   - **Panel de métricas del equipo** (calculado, solo lectura) → con los valores que metiste en el paso 1.
   - Secciones cualitativas (resumen, patrones, fortalezas, jugadores a vigilar, recomendaciones) **editables**.
2. Edita algo si quieres → **Guardar**.
3. **Aprobar** y/o **PDF** (comprueba la portada del equipo + el panel de métricas en el PDF).

✔️ **Comprobar:** el panel de métricas refleja las cifras reales (no inventadas por la IA) y el PDF sale bien.

---

## Qué observar / posibles fallos
- **Panel de métricas vacío** en el informe de equipo → es que en el paso 1 no se guardó ningún dato objetivo, o las pruebas de Carla no tenían métricas. Revisa el paso 1.
- **Botón "Generar" bloqueado** → hay incluidos sin aprobar. Aprueba o desmarca.
- **"API key de Anthropic no configurada"** → falta la env var en Vercel (solo afectaría a la generación IA).
- Con n=1 las "medias" del panel son el valor de Carla y no habrá muchos "outliers"; es esperado.

## Para afinar después (con los fisios)
- Revisar el set de **métricas por prueba** (Ajustes → Deportes y pruebas) y las 3 dudosas: `Abducción en 90°`, `ER/IR 90/90`, `ER/IR Neutro`.
- Definir la **lista real de pruebas de balonmano** (mapeo deporte→pruebas).
- Umbrales del panel (asimetría >15%, percentil <30) — hoy son valores por defecto en código.

> Cuando lo pruebes, avísame y te verifico por la BBDD cada paso (datos guardados, aprobación,
> y la fila del informe de equipo).
