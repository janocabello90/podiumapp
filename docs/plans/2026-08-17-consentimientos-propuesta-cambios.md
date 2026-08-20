# Consentimientos — Propuesta de cambios para satisfacer al club (La Jota)

**Fecha:** 2026-08-17

**Contexto:** revisión legal (padres/club) del documento de consentimiento que firma cada jugador
(`Podium-Documentos-jugadores-*.pdf`), del que además derivan los textos de la anamnesis de la app.

**Aviso:** esto NO es asesoría jurídica. Todo texto legal nuevo debe validarlo el DPD antes de publicarse.




## 1. NIF incorrecto ✅
- **Piden:** corregir B99562729 → **B99562720**.
- **Propuesta:** hecho en la app

## 2. "Documento identificado como borrador"  ✅
- **Piden:** que no figure como borrador.
- **Propuesta:** quitar cualquier marca de agua / etiqueta "BORRADOR" del Word que se manda a firmar.
  *(Nota: la expresión "borrador de informe" que aparece en la cláusula de IA es correcta y conviene
  mantenerla — se refiere a que la IA genera un borrador que revisa un fisio; no es que el documento
  legal sea un borrador.)*


## 3. Separar consentimiento asistencial / datos de salud / imagen (aceptables por separado)  ✅
- **Piden:** que cada finalidad pueda aceptarse o rechazarse por separado.
- **Estado:** la **app ya los tiene separados** (4 consentimientos; imagen opcional y no bloquea).

## 4. Identificar el tratamiento vía VALD Hub (destinatarios, alojamiento, transferencias intl.)
- **Piden:** declarar VALD Hub, sus destinatarios, dónde se aloja y si hay transferencias internacionales.
- **Estado:** la "Ficha del deportista" dice "los datos se usan para crear su perfil en VALD Hub",
  pero NO se declara VALD como encargado ni sus transferencias. La privacidad de la app **ni menciona VALD**.
- **Propuesta (texto a validar por DPO), añadir a la cláusula de datos y a la privacidad:**
  > "Para normalizar los resultados de fuerza y salto y elaborar el informe, se utiliza la plataforma
  > **VALD Hub**, titularidad de **[razón social de VALD]**, que actúa como **encargado del tratamiento**
  > conforme al art. 28 RGPD. Los datos se alojan en **[país/región]** y, en caso de transferencia
  > internacional, se aplican **[Cláusulas Contractuales Tipo / mecanismo de garantía]**."
- **Fuente necesaria (contrato con VALD):** razón social de VALD, país de alojamiento del Hub,
  mecanismo de transferencia (SCC u otro). Con eso relleno los `[...]`.

## 5. Datos del profesional, nº de colegiado y autorización sanitaria del centro
- **Piden:** identificar profesional, colegiado y la autorización sanitaria del centro.
- **Estado:** el Word ya lleva profesional (**Héctor Garrabella, Nº col. 2819**). **Falta el nº de
  registro/autorización sanitaria del CENTRO.**
- **Propuesta:** añadir en la cabecera del consentimiento un campo:
  > "Centro sanitario: FISIO ZARAGOZA — Nº de registro sanitario **[nº]** (autorización de
  > funcionamiento del Gobierno de Aragón)."
- **Fuente necesaria :** número de registro sanitario del centro.


## 6. Autorización sanitaria y promoción comercial = finalidades distintas y separables
- **Piden:** no mezclar la finalidad asistencial con la promocional.
- **Estado:** el texto de "Protección de datos" (Finalidad) **mezcla**: "…evaluación funcional… y,
  previa autorización, captación y difusión de la imagen con fines… promocionales".
- **Propuesta (reescritura de "Finalidad" del consentimiento de datos):**
  > "**Finalidad:** realización de la evaluación funcional, elaboración de los informes y su seguimiento.
  > *(La captación y difusión de imagen/voz con fines divulgativos o promocionales es una finalidad
  > distinta y voluntaria, regulada en el consentimiento de imagen, independiente de este.)*"

## 7. Contradicción: "no se comunican datos a terceros" vs. perfil en plataforma externa
- **Piden:** resolver la contradicción.
- **Estado:** el Word dice "Destinatarios: No se cederán a terceros" y a la vez crea perfil en VALD Hub.
- **Propuesta (reescritura de "Destinatarios"):** distinguir **cesión** de **encargado del tratamiento**:
  > "**Destinatarios:** no se ceden datos a terceros con fines comerciales ni publicitarios. Para prestar
  > el servicio intervienen **encargados del tratamiento** (p. ej. **VALD Hub** para normalizar resultados;
  > proveedor de IA para el borrador del informe; proveedor de infraestructura/alojamiento), todos con
  > contrato conforme al art. 28 RGPD y garantías de transferencia internacional cuando proceda. Además,
  > se comunicarán datos cuando lo exija una obligación legal."

## 8. Titular de la historia clínica y destinatarios del informe
- **Piden:** confirmar quién es titular de la HC y quién recibe los informes.
- **Estado:** no consta en el Word ni en la app. El club figura como "Club/entidad" pero no se dice si
  recibe el informe.
- **Propuesta (añadir cláusula):**
  > "**Titular de la historia clínica:** FISIO ZARAGOZA (la Clínica), responsable de su custodia según
  > la Ley 41/2002. **Destinatario del informe:** el/la deportista (o su representante legal si es menor)."
- **⚠️ DECISIÓN DE NEGOCIO IMPORTANTE :** ¿el **club / cuerpo técnico** va a recibir el informe o
  resultados? Si la respuesta es **SÍ**, el club es un **tercero** y hace falta un **consentimiento
  específico y separado** (opt-in) para esa comunicación. Propuesta de casilla opcional:
  > "☐ Autorizo que la Clínica comparta mi informe y/o resultados de la valoración con mi club
  >  y su cuerpo técnico, con fines de seguimiento deportivo."

---

