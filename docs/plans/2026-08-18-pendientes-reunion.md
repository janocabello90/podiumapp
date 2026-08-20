# SHERPA — Pendientes (para reunión)

**Fecha:** 2026-08-18 · **Estado del proyecto:** en producción, en uso real (balonmano).
_Documento vivo — ampliar con lo que se hable en la reunión._

---

## 0. Resumen en una línea
El **informe individual del deportista está cerrado y validado**. Lo inmediato son **decisiones y
datos** (consentimientos + configurar email). Y el siguiente foco de producto es **pulir el
informe de equipo** (agregado de estudio), que aún está en versión inicial.

---

## 1. 🔴 Consentimientos / legal (urgente — lo pidió el club "La Jota")
Correcciones legales al documento que firman los jugadores. **Todo el detalle, propuestas y lo
que hace falta de Jano/DPO está en:** `docs/plans/2026-08-17-consentimientos-propuesta-cambios.md`.

---

## 2. 🟠 Envío de emails (anamnesis) — construido, falta configurar
La función **ya está hecha** (enviar la anamnesis por email, individual y masivo — un correo por
persona, sin que se vean entre ellos). Falta **configuración**, no programación:
- En Vercel (cuenta de Jano): `RESEND_API_KEY`, `RESEND_FROM` (remitente en `sherpa.fisioreferentes.com`), `NEXT_PUBLIC_APP_URL`.
- Verificar el dominio `sherpa.fisioreferentes.com` en **Resend** (registros DNS).
- Ya hay otra app de fisioreferentes usando Resend → probablemente misma cuenta/clave.
- Decisiones menores: dirección de remitente y de respuesta (reply-to); si queremos registro de envíos.

**Siguiente paso:** decidir remitente + poner las variables (Jano o yo con acceso).

---

## 3. 🟡 Mejorar el INFORME DE EQUIPO (agregado de estudio)
El informe **individual del deportista** ya está pulido (conciso, sin repeticiones, estructura
acordada con los fisios). El **informe de equipo** — el que agrega a todos los jugadores de un
equipo/ronda dentro de un estudio — sigue en **versión inicial (v1)** y no ha tenido esa misma
vuelta de calidad.

**Qué es hoy:** agrega los informes individuales aprobados de un equipo, con un panel de
métricas calculado en código + una síntesis cualitativa de la IA (patrones, riesgos, jugadores
a vigilar, recomendaciones). PDF con maquetación mínima.

**Qué mejorar (a decidir alcance):**
- **Estilo y redacción** igual que el individual: conciso, sin paréntesis de cifras, sin solape entre apartados.
- **Maquetación del PDF**: darle el mismo acabado que el individual (cabecera con logo, flujo natural sin páginas semivacías, portada con datos del estudio/equipo/ronda).
- **Datos objetivos de equipo**: aprovechar la capa de métricas nueva (`session_tests.result_data`) para mostrar estadísticas reales del equipo (medias, distribución de asimetrías, nº de jugadores marcados) en vez de solo texto cualitativo.
- **Desgloses**: hoy solo por equipo; valorar por posición o por edad.
- Revisar que la síntesis por jugador siga bien ahora que el individual ya no tiene "Hallazgos" (usa Conclusiones).

**Siguiente paso:** generar un informe de equipo real, revisarlo con los fisios como hicimos con el individual, y sacar su lista de feedback.

---

## 4. 🔧 Por implementar / a valorar
Seguimientos previstos · profundizar informes con IA.

---

## 5. Para añadir en la reunión
- **Proyecto PLAYBOOK (aparte):** montar la plataforma de **ActiveCampaign**.
- _(espacio para lo que surja)_
-

---

## 🛠️ Deuda técnica _(no para la reunión — solo registro)_
Mejoras internas del código, sin impacto visible para el usuario. Se van metiendo sin prisa.

**Lo que más pesa**
- **Sin tests ni CI.** Cada cambio se valida solo con `build` + revisión manual; no hay pruebas automáticas. Es el mayor hueco teniendo la app en producción.
- **Todo en JSONB sin validación de esquema** (`report_data`, `assessment_data`, `form_data`…). Si la forma llega mal no falla al guardar: falla o se muestra vacío al pintar.
- **Parseo de la IA por texto** (mejorado con parser tolerante + captura de respuesta cruda, pero no es salida estructurada real / JSON schema).

**Media**
- **Orden no determinista de relaciones** (`reports[0]`, `assessments[0]` asumen orden de inserción → con multi-sesión puede mostrar el registro equivocado; en la pantalla de informe ya se ordena por fecha, pero no en todos lados).
- **Cliente admin de Supabase duplicado** (`lib/supabase/admin.ts` vs `createClient` inline en varias rutas → unificar).
- **Gestión de errores irregular** (`console.error` como "gestión", algún `catch {}` vacío; *fire-and-forget* reenviando cookie entre rutas internas, frágil).

**Menor / endurecimiento**
- **Seguridad (advisors de Supabase, WARN, no crítico):** `search_path` sin fijar en un par de funciones; `REVOKE EXECUTE` en funciones RPC ejecutables por `anon`/`authenticated`. Pendiente de la Fase 0.
- **Mantenibilidad:** prompts gigantes embebidos en las rutas de API; lógica de negocio mezclada dentro de las rutas.

**Ya resuelto (no es deuda):** drift de esquema + sistema de migraciones (baseline + MCP); tipos de BD autogenerados; modelos de IA centralizados en `aiConfig.ts`.
