# PLAN — Migración a Sonnet 5 + calidad y coste de informes

> Estado: **planificado, sin ejecutar.** A realizar **después del lanzamiento**, con prueba real antes de dejarlo fijo.
> Objetivo: pasar la generación de informes IA a **Claude Sonnet 5**, con **pensamiento activado** (mejor interpretación de VALD) y **sin cortes**, dejando la base para ver costes.

---

## 0. Contexto (estado actual)

- **Modelo:** `claude-sonnet-4-20250514` (en retirada jun-2026) en `reports/generate` y `reports/campaign-generate`. Clasificación usa Haiku 4.5 (ya actual, no se toca).
- **Llamada:** `anthropic.messages.create({ model, max_tokens: 8000, system, messages })` — **no streaming**, sin pensamiento, sin `temperature`.
- **SDK:** `@anthropic-ai/sdk ^0.39.0` (antiguo).
- **Parseo:** filtra los bloques `type==='text'` de `message.content` y hace `JSON.parse` (con regex de fallback).
- **Tokens:** ya se guardan por informe (`ai_prompt_tokens`, `ai_completion_tokens`, `ai_model`) en la tabla `reports`.

### Datos que motivan el cambio
- Sonnet 5 lee **mejor las gráficas de VALD** (visión de alta resolución) y razona mejor → informes más fiables.
- El informe real ≈ **4.000–5.000 tokens de salida** (medido sobre el PDF de ejemplo: 10 pág., 2.200 palabras).
- Con **pensamiento ON**, `8.000` de tope (pensar + escribir juntos) **se queda corto** → hay que subir a **16.000** y usar **streaming** para evitar timeouts.

---

## 1. Alcance

**Núcleo (esta migración):**
1. Cambiar modelo → `claude-sonnet-5`.
2. **Pensamiento adaptativo ON** + `effort: 'high'`.
3. `max_tokens` 8.000 → **16.000**.
4. **Streaming** (`messages.stream(...).finalMessage()`) para no dar timeout con 16k.
5. **Subir el SDK** `@anthropic-ai/sdk` a la última versión.
6. **Centralizar la config de IA** (modelo, max_tokens, thinking, effort) en un módulo único.

**Relacionado (planificar/ejecutar aparte, opcional):**
7. Guardrail *"solo interpretar pruebas del catálogo"* (independiente; se puede hacer ya).
8. **Caché de prompt** para las guías de equipo (optimización de coste, ver §6).
9. **Coste/tokens en la UI** (admin) (ver `PENDIENTES.md`).

---

## 2. Comprobación de breaking changes (Sonnet 4 → Sonnet 5)

Revisado contra la guía oficial de migración. Nuestro código **no usa** ninguno de los patrones que rompen:

| Cambio que rompe en Sonnet 5 | ¿Nos afecta? |
|---|---|
| `thinking: {budget_tokens}` (400) | ❌ No lo usamos |
| `temperature`/`top_p`/`top_k` (400) | ❌ No los usamos |
| Prefill del último turno assistant (400) | ❌ No lo usamos (mensajes = user + bloques doc) |
| Pensamiento ON por defecto al omitir `thinking` | ✅ Lo fijamos explícito a `adaptive` |
| `thinking.display` por defecto `omitted` | ✅ No mostramos el pensamiento; el parser ya filtra solo `type==='text'`, los bloques `thinking` se ignoran |
| Tokenizador nuevo (~+30% tokens) | ⚠️ Coste ~+30% (compensado por promo hasta 31-ago); `max_tokens` 16k cubre el texto |
| Bedrock + `tool_choice` forzado | ❌ N/A (no usamos Bedrock ni forzamos tool_choice) |

**Conclusión:** migración limpia. El riesgo real está en (a) el salto de versión del SDK y (b) que el pensamiento no corte la salida — ambos cubiertos abajo.

---

## 3. Pasos de implementación (en orden)

1. **Subir SDK** → `npm i @anthropic-ai/sdk@latest`. `npm run build` para detectar cambios de tipos (solo 3 ficheros lo importan: `reports/generate`, `reports/campaign-generate`, `patients/classify`).
2. **Crear `src/lib/reports/aiConfig.ts`** — un único sitio para: `REPORT_MODEL = 'claude-sonnet-5'`, `REPORT_MAX_TOKENS = 16000`, `REPORT_THINKING = { type: 'adaptive' }`, `REPORT_EFFORT = 'high'`. (Resuelve la deuda "modelos hardcodeados" del `CLAUDE.md` §11.8.)
3. **`reports/generate`:**
   - Sustituir `messages.create({...})` por:
     ```ts
     const stream = anthropic.messages.stream({
       model: REPORT_MODEL,
       max_tokens: REPORT_MAX_TOKENS,
       thinking: REPORT_THINKING,
       output_config: { effort: REPORT_EFFORT },
       system: systemPrompt,
       messages: [{ role: 'user', content: [...docBlocks, { type: 'text', text: userText }] }],
     })
     const message = await stream.finalMessage()
     ```
   - El **parseo posterior no cambia** (sigue leyendo `message.content` → bloques `text`).
   - `ai_model` del insert → `REPORT_MODEL` (no hardcodear).
4. **`reports/campaign-generate`:** mismo cambio (streaming + config + `ai_model`).
5. **Verificar el parser** ante bloques `thinking` (deben ignorarse; ya se filtran por `type==='text'`).
6. `npm run build` (compila + typecheck) en verde.

---

## 4. Pruebas (obligatorias antes de dejarlo fijo)

- Generar **un informe individual** y **uno de equipo** reales.
- Verificar: **no se corta** (JSON completo y válido), calidad de interpretación (lee bien las gráficas VALD), y que se guardan `ai_prompt_tokens`/`ai_completion_tokens`.
- **Coste real:** consultar por BBDD los tokens de esos informes y calcular el € (tokens × precio Sonnet 5). Comparar con la estimación (~$0,34–0,51 el de equipo con 22 pruebas).
- Si el informe sale **cortado** → subir `max_tokens` a 20–24k (con streaming no hay problema de timeout) o bajar `effort` a `medium`.

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El salto de SDK rompe tipos/compilación | `npm run build` local antes de push; solo 3 ficheros usan el SDK; revertir versión si hiciera falta |
| Pensamiento consume presupuesto y corta el informe | `max_tokens` 16k + streaming; plan B: 20–24k o `effort: medium` |
| Coste ~+30% por tokenizador | Aceptado (céntimos); promo hasta 31-ago lo compensa; §6 lo reduce a futuro |
| Fallo en vivo | Diff pequeño y localizado → rollback (revertir modelo/params en `aiConfig.ts`) |

---

## 6. Fase opcional — Caché de prompt (reducir coste de equipo ~60%)

**Problema:** en balonmano se hacen las 22 pruebas → cada informe envía las **22 guías (~84k tokens)**, idénticas entre jugadores. Es el 70% del coste.

**Solución:** reordenar el prompt para que **lo estable (system + estructura + las 22 guías) vaya primero**, con un punto de caché (`cache_control`), y **los datos del jugador (anamnesis, notas, PDFs) vayan después**. Generando los informes de un equipo **seguidos** (dentro de la ventana de caché), las guías se cobran ~10% en los informes posteriores al primero.

**Efecto (equipo de 15):** de ~$5,1 a ~$2,0 (~60% menos).

**Coste de implementación:** medio — hay que separar en el prompt el bloque "guías del deporte" (estable) del bloque "datos del jugador" (variable), y añadir el breakpoint de caché. Requiere el SDK nuevo. **Se hace después de validar la migración base.**

---

## 7. Decisiones a confirmar antes de ejecutar

1. **¿Pensamiento ON o OFF?** → Recomendado **ON** (calidad; 16k + streaming). Alternativa mínima: OFF + 8k (como hoy, pero con Sonnet 5 y su mejor visión).
2. **¿`effort` high o xhigh?** → **high** (equilibrio calidad/coste/latencia). `xhigh` solo si se quiere exprimir y asumir más coste/tiempo.
3. **¿Incluir la caché (§6) en esta tanda o después?** → Recomendado **después** de validar la base.

---

## 8. Checklist de ejecución

- [ ] `npm i @anthropic-ai/sdk@latest` + build verde
- [ ] `lib/reports/aiConfig.ts` creado
- [ ] `reports/generate`: streaming + config + `ai_model` dinámico
- [ ] `reports/campaign-generate`: streaming + config + `ai_model` dinámico
- [ ] Build (compila + typecheck) OK
- [ ] Prueba informe individual (no corte, JSON válido, calidad)
- [ ] Prueba informe de equipo (no corte, JSON válido, calidad)
- [ ] Coste real medido en BBDD y comparado con estimación
- [ ] (Opcional) Guardrail "solo catálogo"
- [ ] (Opcional, aparte) Caché de guías §6
- [ ] (Opcional, aparte) Coste/tokens en UI
