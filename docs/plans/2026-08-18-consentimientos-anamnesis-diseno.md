# Diseño — Consentimientos + anamnesis (cambios aprobados por el club)

**Fecha:** 2026-08-18 · **Estado:** aprobado, en implementación.
**Origen:** revisión legal del club "La Jota" (ver `docs/plans/2026-08-17-consentimientos-propuesta-cambios.md`).
**Aviso:** no es asesoría jurídica; todo texto legal nuevo debe validarlo el **DPO** antes de usarse con pacientes reales.

## Resumen
Actualizar los consentimientos y la anamnesis para que, tanto en la app como en un PDF
imprimible para rellenar a mano, salga todo como pidió el club. La app es la **única fuente de
verdad**: el PDF imprimible se genera a partir de los mismos textos (`consent_versions`), para
que papel y app no se descuadren nunca (la causa del lío del NIF fue tener dos fuentes).

## Decisiones tomadas
- **PDF imprimible lo genera la app** desde los mismos textos de consentimiento.
- **Consentimiento de "compartir informe con el club" = OPCIONAL** (opt-in para equipos; NO bloquea
  el envío). El club **puede** recibir el informe solo si el/la deportista lo autoriza. Se dejó
  opcional a propósito para respetar el principio RGPD de consentimiento libre.
- **PDF de tipo imprimir-y-rellenar-a-mano** (en blanco, con casillas/líneas). Sin campos de formulario.
- **Forma jurídica: `S.L.`** (confirmado) → unificar en toda la app (hoy pone "S.L.P." en aviso legal / privacidad / cookies).
- Empezamos por la audiencia **equipo/deportista** (el caso del club); la variante clínica individual, después.

---

## A. Textos de consentimiento (Ajustes → Consentimientos + Privacidad)
Se **reescribe** el consentimiento de **Protección de datos** (`data_processing`). Texto propuesto
(placeholders entre `[...]` pendientes de datos + validación DPO):

> **INFORMACIÓN BÁSICA SOBRE PROTECCIÓN DE DATOS**
> **Responsable:** FISIO ZARAGOZA, S.L. (CIF B99562720), Calle Almagro 16, 50004 Zaragoza. Centro
> sanitario nº de registro `[Nº REGISTRO SANITARIO]` (autorización de funcionamiento del Gobierno de Aragón).
> **Finalidad:** realización de la evaluación funcional, elaboración de los informes y su seguimiento.
> (La captación y difusión de imagen/voz con fines divulgativos o promocionales es una finalidad
> distinta y voluntaria, regulada en el consentimiento de imagen, independiente de este.)
> **Legitimación:** consentimiento explícito del interesado o de su representante legal.
> **Datos tratados:** identificativos y datos de salud (categoría especial).
> **Destinatarios:** no se ceden datos a terceros con fines comerciales ni publicitarios. Para
> prestar el servicio intervienen **encargados del tratamiento**: **VALD Hub** (titularidad de
> `[RAZÓN SOCIAL VALD]`) para normalizar los resultados de fuerza y salto; el proveedor de IA
> (Anthropic) para el borrador del informe; y el proveedor de infraestructura/alojamiento. Todos
> con contrato conforme al art. 28 RGPD. Los datos de VALD Hub se alojan en `[PAÍS/REGIÓN]` y, en
> caso de transferencia internacional, se aplican `[MECANISMO: CCT/otro]`. Además, se comunicarán
> datos cuando lo exija una obligación legal.
> **Titular de la historia clínica:** FISIO ZARAGOZA, S.L. (custodia según Ley 41/2002).
> **Destinatario del informe:** el/la deportista (o su representante legal si es menor)`[; y el
> club, si se acepta el consentimiento correspondiente]`.
> **Conservación / Derechos / Marco normativo:** (se mantiene lo actual — RGPD, LOPDGDD, Ley
> 1/1982, Ley 41/2002; derechos ante rgpd@fisiozaragoza.com y AEPD).

**Página de privacidad** (`src/app/privacidad/page.tsx`): añadir **VALD Hub** a la lista de
encargados (§7) con su alojamiento/transferencia, y unificar la denominación a `S.L.`.

**Cubre:** items 4 (VALD), 5 (registro sanitario), 6 (separar finalidad), 7 (contradicción terceros), 8 (titular/destinatario).

---

## B. Consentimiento nuevo: "Compartir informe con el club" (OPCIONAL, solo equipo)
- Nuevo tipo de consentimiento `report_sharing_club`.
- **Opcional para audiencia equipo** (opt-in; NO bloquea el envío), igual que el de imagen.
- **No aparece en la anamnesis individual** (clínica).
- Texto (completo, sin placeholder):
  > "Autorizo que la Clínica comparta mi informe y/o los resultados de la valoración con mi club
  > y su cuerpo técnico, con fines de seguimiento deportivo."
- Editable en Ajustes → Consentimientos como los demás; se registra en `consents` (con copia del texto).
- Se dejó opcional (no bloqueante) para respetar el principio RGPD de consentimiento libre.

---

## C. PDF imprimible en blanco (lo genera la app)
Documento "Anamnesis + consentimientos (en blanco)" para imprimir y rellenar a mano, generado con
jsPDF desde los mismos `consent_versions`:
- **Cabecera:** centro (FISIO ZARAGOZA, S.L. + nº registro sanitario) · profesional/colegiado · fecha.
- **Datos del deportista** (en blanco: nombre, DNI, fecha nac., sexo, equipo/club, posición, altura/peso, lateralidad).
- **Historial de lesiones** (tabla en blanco) · **Estado actual** (líneas).
- **Consentimientos**: los mismos textos, cada uno con casilla `[ ]` para marcar (bloqueantes marcados como obligatorios; imagen como opcional con sus canales).
- **Firmas**: bloque del **deportista mayor de edad** Y bloque del **representante legal (menor)** — un único documento cubre ambos casos.
- **Botón de descarga**: "Descargar plantilla en blanco (PDF)" (ubicación: Ajustes → Consentimientos y/o ficha del paciente — a concretar en implementación).
- Al salir de `consent_versions`, **se actualiza solo** cuando se cambian los textos.

---

## D. Alcance de datos / secuenciación
- **Se construye ya (no necesita datos de Jano):** consentimiento del club (bloqueante), PDF
  imprimible, unificación `S.L.P.`→`S.L.`, y la estructura del texto de Protección de datos.
- **Placeholders temporales** (se rellenan cuando lleguen): `[RAZÓN SOCIAL VALD]`, `[PAÍS/REGIÓN]`,
  `[MECANISMO transferencia]`, `[Nº REGISTRO SANITARIO]`.
- ⚠️ **No enviar anamnesis a pacientes reales** hasta rellenar los placeholders **y** tener el
  visto bueno del DPO.

### Datos pendientes de Jano (recordatorio)
1. VALD: **razón social** + **país de alojamiento** + **mecanismo de transferencia** (CCT u otro).
2. **Nº de registro sanitario** del centro.
3. ~~Forma jurídica~~ → **S.L.** (confirmado).
4. ~~¿Club recibe informe?~~ → **Sí, y su consentimiento es bloqueante** (confirmado).

---

## Plan de implementación
1. **Consentimiento del club**: nuevo tipo `report_sharing_club` (enum/tipos + seed en `consent_versions`); checkbox bloqueante en `AnamnesisFormClient` (solo equipo); registro en `/api/anamnesis/[token]`.
2. **Texto de Protección de datos**: reescribir el `consent_versions` activo (con placeholders + S.L.).
3. **Privacidad + páginas legales**: añadir VALD Hub; unificar `S.L.P.`→`S.L.` en aviso-legal, privacidad y cookies.
4. **PDF imprimible en blanco**: nueva ruta `POST /api/consents/print-template` (jsPDF) + botón de descarga.
5. **Build + revisión.**

## Riesgos / notas
- Legal: texto pendiente de DPO; consentimiento del club bloqueante a validar.
- Cambiar textos en `consent_versions` afecta a lo que ve el paciente al instante → no difundir hasta cerrar placeholders + DPO.
- `consents` guarda copia del texto aceptado (`version_body`) → trazabilidad intacta.
