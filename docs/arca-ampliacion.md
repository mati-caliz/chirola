# Ampliación de la integración con ARCA

Plan por fases para completar y extender la integración fiscal. Cada fase es autocontenida y
entregable por separado.

El alcance **hoy** está en `docs/arquitectura.md`; el backlog general de producto (UI, infra,
auth) en `docs/roadmap.md`. Este doc cubre sólo lo que toca el protocolo ARCA.

Convención: 🔴 bloqueante para casos de uso ya declarados · 🟡 alto valor de negocio ·
🟢 nice-to-have.

---

## Estado actual del protocolo

Servicios ARCA integrados: **WSAA** (autenticación) y **WSFEv1** (facturación mercado interno).

Operaciones de WSFEv1 en uso (`services/api/src/arca/wsfe/wsfe.service.ts`):
`FEDummy`, `FECompUltimoAutorizado`, `FEParamGetPtosVenta`, `FEParamGetTiposCbte`,
`FECompConsultar`, `FECAESolicitar`.

Comprobantes emitibles: Factura, NC y ND en las letras **A, B y C** (códigos 1-3, 6-8, 11-13).

`ArcaService` en `wsaa.types.ts` ya declara `ws_sr_padron_a13` y `ws_sr_constancia_inscripcion`,
pero **ningún código los usa todavía**: el tipo está adelantado, la integración no existe.

---

## Fase A — 🔴 Cerrar los huecos del comprobante actual

Son limitaciones del armado de `FECAEDetRequest`, no features nuevas. Hay casos que la app
declara soportar y que ARCA rechazaría.

### A.1 ✅ Concepto "servicios" y "productos y servicios" — implementado

Reglas del protocolo:

- `Concepto = 1` (productos): los tres campos deben **omitirse**.
- `Concepto = 2` (servicios) y `3` (productos y servicios): los tres son **obligatorios**,
  formato `AAAAMMDD`.
- `FchServDesde <= FchServHasta`.
- `FchVtoPago` es la fecha de vencimiento del pago; para comprobantes de contado se usa la
  misma fecha del comprobante.

`servicePeriod` (`from`, `to`, `paymentDueDate`) viaja en `issueVoucherSchema` en formato
`AAAA-MM-DD` y se convierte a formato ARCA recién en `buildDetail`. El `superRefine` lo exige
para conceptos 2 y 3, y lo **prohíbe** para el 1.

Junto con esto se corrigió el orden de `ImpTrib` / `ImpIVA` en `FECAEDetRequest`: estaban
invertidos respecto del XSD, que define una `sequence` estricta.

Pendiente: emitir una Factura C de servicios contra homologación y confirmar el CAE. Depende del
bloqueante 1.1 de `docs/roadmap.md`.

### A.2 ✅ Importes exentos y no gravados — implementado

Reglas del protocolo:

- `ImpTotal = ImpTotConc + ImpNeto + ImpOpEx + ImpIVA + ImpTrib`. ARCA valida la identidad y
  rechaza con **error 10048** si no cierra (tolerancia de redondeo muy chica).
- Un ítem exento no lleva entrada en el array `Iva`; uno gravado a 0% sí (alícuota id 3).
  Son cosas distintas y se confunden seguido.
- En Factura C (monotributo) `ImpNeto` es el total y no se informa `Iva`.

El tratamiento de cada ítem es **explícito** (`TaxTreatment`: `TAXED` / `EXEMPT` / `UNTAXED`), no
inferido de la alícuota: es lo que permite distinguir un ítem gravado al 0% de uno exento, que
en el XML son cosas distintas. Los ítems no gravados y exentos no llevan alícuota, y el schema
lo rechaza si la traen.

### A.3 ✅ Tributos (percepciones y retenciones) — implementado

Estructura por tributo: `Id`, `Desc`, `BaseImp`, `Alic`, `Importe`. La suma de los `Importe`
debe igualar `ImpTrib`.

Tipos: 1 nacionales · 2 provinciales · 3 municipales · 4 internos · 99 otros. Están como
constantes en `packages/shared`; sincronizarlos contra `FEParamGetTiposTributos` queda en A.5.

El cliente manda `id`, `description`, `taxableBase` y `rate`; el **importe lo calcula el
backend** (`iva-calculator.ts`), nunca el mobile. Los tributos se suman al `ImpTotal` y se
persisten en `Voucher.tributes`.

### A.4 ✅ Cotización de moneda extranjera — implementado

Regla: la cotización a usar es la del **día hábil anterior** a la fecha del comprobante. Cuando
no se manda `FchCotiz`, ARCA devuelve la última vigente, que es lo que la app usa.

`getExchangeRate` y `getCurrencies` (que descarta las monedas con `FchHasta`) se exponen en
`GET /issuers/:id/exchange-rate/:currencyId` y `GET /issuers/:id/currencies`. La app trae la
cotización al elegir moneda y deja editarla, porque ARCA valida contra la suya (**error 10051**).

### A.5 ✅ Completar los `FEParamGet*` — implementado

Se agregaron `TiposDoc`, `TiposIva`, `TiposTributos`, `TiposOpcional` y `CondicionIvaReceptor`,
todos sobre un helper común, y se expone `GET /issuers/:id/params/:paramType`.

Detalle del protocolo que vale recordar: ARCA devuelve el **literal `"NULL"`** en `FchHasta`
para los registros vigentes, no una cadena vacía. Filtrar por "vacío" descarta todo.

La caché (`ArcaParamCache`, TTL 7 días vía `ARCA_PARAM_CACHE_TTL_DAYS`) es **por emisor**, no
global: `FEParamGetTiposCbte` devuelve los tipos habilitados para ese contribuyente en
particular — es justamente de donde `inferFiscalCondition` deduce si es RI o monotributista.

Degradación en tres pasos: caché vigente → caché vencida si ARCA no responde → constantes
locales de `packages/shared`. Las constantes pasan a ser el último recurso, no la fuente de
verdad. `FEParamGetTiposMonedas` y `PtosVenta` quedan fuera de la caché a propósito: los puntos
de venta cambian cuando el usuario da uno de alta en ARCA y un TTL largo sería molesto.

---

## Fase B — ✅ Padrón: consulta de contribuyentes por CUIT — implementado

Autocompleta razón social, condición frente al IVA y domicilio a partir del CUIT.
Se integró `ws_sr_constancia_inscripcion` (padrón A5), el más completo de los dos:

| Servicio | Qué devuelve | Nota |
|---|---|---|
| `ws_sr_constancia_inscripcion` | Datos de la constancia: razón social, domicilio, impuestos y regímenes, categoría de monotributo | El más completo |
| `ws_sr_padron_a13` | Padrón alcance 13: identificación y domicilio | Más liviano |

Puntos importantes del protocolo:

- Se autentican por **WSAA igual que `wsfe`**, pero requieren que el certificado tenga **ese
  servicio asociado en ARCA** (trámite aparte por servicio). Un cert que sólo tiene `wsfe`
  falla con "computador no autorizado".
- Son SOAP pero con un WSDL distinto al de WSFEv1; hay endpoint separado de homologación y
  producción.
- El ticket de acceso es **por servicio**, y cada uno tiene su propia vigencia de 12 horas.
  `AccessTicketCache` ya está modelado con clave única `(issuerId, service)`, así que no hace
  falta tocarlo.

La condición frente al IVA **no viene dada** por el padrón: se deduce de los impuestos en los que
figura inscripto (`inferRecipientIvaCondition` en `packages/shared`). Monotributo gana sobre IVA
porque un monotributista puede figurar en ambos padrones.

La respuesta se cachea en `TaxpayerCache` con TTL de 30 días (`PADRON_CACHE_TTL_DAYS`). La caché
es **global, no por emisor**: son datos públicos de ARCA, no datos de un contribuyente usuario,
así que la regla de aislamiento por `issuerId` no aplica. El `issuerId` de la ruta se usa sólo
para elegir el certificado con el que se consulta.

**Coherencia de `CondicionIVAReceptorId` con la letra.** ARCA rechaza el comprobante cuando la
condición del receptor no corresponde a la letra: una A va **sólo** a Responsable Inscripto, y una
B a cualquiera **menos** un Responsable Inscripto (la C no restringe, porque no discrimina IVA).
Eso se valida ahora en el schema, antes de gastar la llamada y el número.

La validación es deliberadamente **permisiva con lo que no conoce**: si el id no está en la tabla
local de `RecipientIvaCondition`, pasa. `FEParamGetCondicionIvaReceptor` devuelve más condiciones
de las que la app enumera (cliente del exterior, IVA liberado, no alcanzado), y rechazar una
condición legítima por no tenerla en la lista sería peor que dejar que ARCA la juzgue.

Se eligió esta validación en vez de consultar el padrón en cada emisión: es determinística, no
agrega latencia ni una dependencia de red al camino crítico del CAE, y cubre el error frecuente.
El padrón sigue usándose para **prellenar**.

Al hacerlo apareció que `defaultRecipientIvaCondition` deducía el default de `requiresRecipientCuit`,
que con la M y la FCE dejó de ser equivalente a "letra A": una FCE B habría defaulteado a
Responsable Inscripto, que es justo lo que la letra B prohíbe. El default ahora sale de
`discriminatesIva`.

Pendiente: prellenado del padrón en el alta de `Client` (hoy sólo está en la nueva factura).

---

## Fase C — 🟡 Más tipos de comprobante

### C.1 ✅ Factura M (códigos 51, 52, 53) — implementado

Los emisores nuevos cuya capacidad económica ARCA no acredita **sólo pueden emitir M** en lugar
de A. Antes de esto, ese emisor simplemente no podía facturar desde la app.

Reglas del régimen que se modelaron:

- La M **discrimina IVA igual que la A** y exige identificar al receptor con **CUIT**. El
  calculador dejó de usar `requiresRecipientCuit` como proxy de "letra A" y ahora pregunta por
  `discriminatesIva`, que es lo que realmente se está decidiendo.
- El receptor actúa como **agente de retención de IVA y Ganancias** (RG 1575), y el comprobante
  debe llevar la leyenda que lo dice: se imprime en el PDF vía `requiresRetentionNotice`.
- Un emisor habilitado a M **también tiene la B habilitada** (le factura a consumidor final), así
  que `inferFiscalCondition` chequea el 51 **antes** que el 1/6: si preguntara primero por la B lo
  clasificaría como responsable inscripto común y la M nunca aparecería.

`voucherLetter` parseaba la letra del nombre con un regex `[ABC]` que descartaba la M en silencio
—el PDF caía a `'X'` y el libro IVA ventas salteaba el comprobante—; ahora cubre `[ABCM]`.

El selector de tipo en la app dejó de ser una lista fija de tres: sale de `FEParamGetTiposCbte`
(cacheado por emisor) intersectado con los tipos que la app sabe emitir, de manera que la M
aparece sólo para quien la tiene habilitada. Sin conexión cae a A/B/C.

De paso se agregó al schema la validación de que los comprobantes que exigen CUIT no viajen con
DNI o consumidor final: antes se mandaban a ARCA y volvían rechazados.

Pendiente: el régimen de retención tiene un piso de monto por debajo del cual no aplica; hoy la
leyenda se imprime siempre. Confirmar el piso vigente antes de condicionarla.

### C.2 ✅ FCE MiPyME (códigos 201-213) — implementado

Factura de Crédito Electrónica, **obligatoria** para operaciones de PyME con empresas grandes por
encima de cierto monto.

Se agregó el nodo `<Opcionales>` genérico al final de `FECAEDetRequest` (va **después** de `Iva`,
según la `sequence` del XSD). Los ids que usa la FCE:

- `2101` — **CBU** del emisor donde se cobra. Obligatorio en la factura: sin él ARCA rechaza, así
  que el backend corta antes de llamar y pide cargarlo.
- `2102` — alias de la cuenta, opcional.
- `27` — tipo de transmisión: `SCA` (circulación abierta) o `ADC` (agente de depósito colectivo).
- `22` — marca de anulación, que llevan las NC/ND de FCE en vez del CBU.

El CBU y el alias viven en `Issuer` (`PATCH /issuers/:id/payment-account`), no en cada
comprobante: son datos de la cuenta del emisor, no de la operación.

**El cambio menos obvio de esta fase:** la FCE exige `FchVtoPago` **aunque el concepto sea
productos**, y hasta acá `paymentDueDate` vivía adentro de `servicePeriod`, que el schema prohíbe
para concepto 1. Quedaba una FCE de productos imposible de expresar. Se separó: `servicePeriod`
es `{ from, to }` y `paymentDueDate` es un campo propio, obligatorio cuando el concepto es
servicios **o** cuando el comprobante es FCE. Las columnas de la DB ya estaban separadas, así que
el cambio fue de contrato, no de modelo.

Los nombres de los tipos terminan en la letra (`Factura de Crédito MiPyME A`) para que
`voucherLetter` los siga resolviendo, y todos exigen CUIT del receptor: la FCE se le emite a una
empresa registrada, nunca a consumidor final.

Pendiente: la **anulación** de una FCE (el receptor la rechaza) informa el opcional 22 en `S`.
Hoy se emite siempre en `N`, que es la NC/ND común; el circuito de rechazo no está modelado.

### C.3 ✅ Exportación — WSFEX (tipos 19, 20, 21) — implementado (backend)

Facturación de exportación: Factura E, ND E y NC E. Es un **servicio SOAP distinto** (`wsfex`),
no una extensión de WSFEv1: otro WSDL, otro namespace, otro set de operaciones y un ticket WSAA
propio — que necesita **su propia asociación de certificado en ARCA**, aparte de la de `wsfe`.

Diferencias de negocio que hubo que modelar:

- **Sin IVA.** No hay array `Iva` ni `ImpIVA`: la operación de exportación no lo lleva. En la DB
  el total se guarda como exento, para que el libro IVA no lo cuente como débito.
- **Receptor sin CUIT argentino.** Se identifica con `Dst_cmp` (país), `Cuit_pais_cliente` (el
  CUIT que ARCA asigna a cada país, de `FEXGetPARAM_DST_CUIT`), domicilio del exterior y, si
  tiene, su identificación tributaria local.
- **Campos propios**: Incoterm, idioma del comprobante (español / inglés / portugués), permiso
  de embarque, destino y forma de pago.

Reglas del protocolo que condicionan el armado:

- `Tipo_expo` distingue bienes (1), servicios (2) y otros (4). El **permiso de embarque sólo
  aplica a bienes**, y el Incoterm es obligatorio ahí; el schema rechaza un permiso en una
  exportación de servicios en vez de mandarlo y comerse el rechazo.
- Cada ítem informa `Pro_total_item` = cantidad × precio − bonificación, e `Imp_total` es la suma
  de todos. La cuenta la hace el backend.
- Los errores **no vienen en `Errors` como en WSFEv1**, sino en `FEXErr` con `ErrCode` / `ErrMsg`,
  y `ErrCode = 0` significa OK. Tratar la presencia del nodo como error rompe todas las llamadas.

**Lo mejor de WSFEX y lo que conviene no perder**: cada pedido lleva un `Id` propio, que se saca
de `FEXGetLast_ID` + 1. Si se reenvía el mismo `Id`, ARCA **no emite otro comprobante**: devuelve
el que ya autorizó con `Reproceso = S`. Es protección contra duplicados incorporada al protocolo,
bastante mejor que la reconciliación que hubo que construir a mano para WSFEv1 en D.1. El
resultado marca `reprocessed` para poder distinguirlo.

Pendiente: la pantalla de emisión de exportación en la app (hoy sólo está `POST /export-vouchers`),
y las tablas de parámetros de WSFEX no se cachean como las de WSFEv1 en A.5.

## Fase D — 🟡 Reconciliación y robustez

### D.1 ✅ Reconciliar contra ARCA lo que la app perdió — implementado

El agujero: si se cortaba la red **después** de que ARCA otorgó el CAE, el comprobante quedaba
emitido en ARCA y `PENDIENTE` en la DB. El reintento pedía `FECompUltimoAutorizado`, que ya
incluía ese comprobante, y emitía **uno nuevo con el número siguiente**: dos comprobantes
fiscales por la misma venta.

Ahora `PendingVoucher` guarda el número que se llegó a intentar, y antes de re-emitir se
consulta `FECompConsultar` por ese número. El CAE sólo se adopta si el comprobante en ARCA
**coincide en total y receptor** con el encolado; si no coincide, es de otra operación y se
emite uno nuevo. Sin esa verificación se estaría adoptando un CAE ajeno.

`GET /issuers/:issuerId/reconciliation/numbering` compara `FECompUltimoAutorizado` contra el
último número en DB por punto de venta y tipo, para detectar desincronizaciones antes de que
rompan una emisión.

### D.2 ✅ Registro de las llamadas SOAP — implementado

Se guarda cada llamada a ARCA en `ArcaCallLog`: servicio, operación, estado HTTP, duración,
resultado (`SUCCESS` / `REJECTED` / `FAULT` / `NETWORK_ERROR`), códigos de error y los XML de ida
y vuelta. Sin el XML original, un rechazo con código numérico se diagnostica a ciegas.

Se descartó `ServiceAuditLog` como base: ese registro es de las llamadas HTTP que entran por la
API pública y cuelga de un `apiClientId` obligatorio, que en una emisión desde la app no existe.

**Redacción, que es el punto delicado**: se tapan `Token` y `Sign` del bloque `Auth` de WSFEv1,
el `in0` (CMS firmado) que se manda a WSAA y el `loginCmsReturn` completo de la respuesta. Ese
último importa aparte: el ticket viene ahí como XML **escapeado** (`&lt;token&gt;`), así que una
redacción por nombre de tag no lo encuentra y el ticket quedaría en la base en texto plano.

El `NETWORK_ERROR` se registra a propósito: es justo el caso que **no deja rastro en ARCA** y el
que dispara la reconciliación de D.1.

Detalles de implementación que condicionan el resto:

- `AuthContext` ganó `issuerId`. Antes sólo llevaba el CUIT, y el registro tiene que quedar
  atado al emisor, no a un número que puede repetirse entre entornos.
- Los servicios reciben la interfaz `ArcaCallRecorder` por token de inyección, no la clase. Así
  los tests pasan un doble propio sin castear nada.
- Escribir el registro **nunca** rompe la emisión: `record` se traga sus propios errores.
- Los XML se truncan a 20.000 caracteres y se purgan cada 6 horas según
  `ARCA_CALL_LOG_RETENTION_DAYS` (30 por defecto). Son blobs y crecen rápido.

`GET /issuers/:id/arca-calls` lista las llamadas del emisor (metadatos, sin los XML, que son
grandes) y `GET /issuers/:id/arca-calls/:callId` devuelve una con el XML redactado. Ambos filtran
por el `issuerId` del contexto autenticado: el registro guarda el XML de comprobantes ajenos, así
que un emisor no puede ver el de otro. Las llamadas sin emisor (el `FEDummy` de health-check) no
aparecen en ninguna lista de usuario.

### D.3 ✅ Estados de `Voucher` como enum tipado — implementado

`status` era string libre con el valor en español (`"AUTORIZADO"`, `"PENDIENTE"`), en contra de
la regla de naming. Ahora son dos enums en `packages/shared`:

- `VoucherStatus`: `PENDING` · `APPROVED` · `RECOVERED` · `OBSERVED` · `REJECTED`.
- `PendingVoucherStatus`: `PENDING` · `FAILED` (antes `"ERROR"`).

El texto en español pasó a `voucherStatusName`, que la app usa para mostrarlo.

`RECOVERED` es el estado que trajo D.1: el comprobante cuyo CAE se adoptó de ARCA en vez de
emitirlo. Distinguirlo importa porque es el único que la app no emitió ella misma.

**El riesgo de agregar un estado autorizado nuevo** es que las consultas que filtraban por
`AUTORIZADO` lo dejen afuera en silencio — el libro IVA ventas se calcula así, y un comprobante
recuperado desaparecería del débito fiscal. Por eso el filtro se hace con
`authorizedVoucherStatuses` / `isAuthorizedStatus` y no con una comparación suelta: el día que se
agregue otro estado autorizado, se agrega en un solo lugar.

La migración `20260817190000_voucher_status_enum` reescribe los valores ya guardados antes de
cambiar el default.

**Observaciones de ARCA.** `FECAESolicitar` puede devolver `Resultado = A` (autorizado) **con**
un nodo `<Observaciones>`: el CAE es válido, pero ARCA avisa algo que conviene corregir. Hasta
acá esas advertencias se descartaban en el parseo —la columna `arcaObservations` existía y nunca
se escribía—, así que el usuario no se enteraba nunca. Ahora se guardan y el comprobante queda en
`OBSERVED`.

`OBSERVED` está en `authorizedVoucherStatuses`: el comprobante **tiene CAE y es válido**, así que
tiene que seguir contando en el libro IVA. Dejarlo afuera por "observado" sería subdeclarar.

Ojo con el orden al mostrarlo: la app derivaba el estado visual preguntando primero si hay CAE, y
un comprobante observado tiene CAE — se veía como aprobado común y el aviso no aparecía nunca. La
observación se chequea antes.

## Fase E — 🟢 Compras y otros servicios

### E.1 ✅ Importación de "Mis Comprobantes" — implementado (backend)

ARCA no expone API pública de Mis Comprobantes, pero deja exportar CSV desde el portal. El
importador convierte la app de "facturador" a "libro IVA completo" sin depender de un servicio
nuevo.

`POST /purchase-invoices/import/preview` clasifica sin escribir; `POST /purchase-invoices/import`
hace lo mismo y persiste. El import **vuelve a parsear el CSV** en vez de confiar en las filas
que devuelve la preview: si aceptara filas del cliente, el cliente podría cargar importes que
nunca estuvieron en el archivo de ARCA.

Formato del export, que es lo que no es derivable del código:

- Separador `;` o `,` según la configuración regional del que exporta; se detecta por línea de
  encabezado.
- Importes en formato argentino (`1.234,56`) o con punto decimal, mezclados entre archivos.
- Fechas `dd/mm/aaaa` o ISO.
- Encabezados con acentos y BOM al principio.

**El problema de fondo:** el CSV informa el **IVA total**, no el desglose por alícuota, y
`PurchaseInvoice` guarda por alícuota (21 / 10,5 / 27). La alícuota se deduce del cociente
`IVA / neto gravado`; cuando no da ninguna conocida, la fila **no se importa** y se marca
`NEEDS_REVIEW` para carga manual. Adivinar el desglose de una factura con alícuotas mezcladas
sería meter números inventados en el libro IVA.

Por el mismo motivo se rechaza la fila cuyo total del archivo no coincide con la suma de los
importes que sí se importan: el export trae una columna de **otros tributos** que el modelo no
tiene, y sin ese control la diferencia se perdería en silencio.

Las filas ilegibles se juntan y se informan con número de línea en vez de abortar el archivo
entero: un export de un año tiene cientos de filas y una sola mala no debería tirar todo.

De paso se corrigió un error previo del libro IVA: `computeCredit` sumaba el IVA de **todas** las
compras, así que una **nota de crédito recibida aumentaba** el crédito fiscal en vez de
reducirlo. El signo sale de `isCreditNote(invoiceType)`, igual que en el débito; no hizo falta
modelar el signo aparte porque el tipo de comprobante ya lo dice. El importador lo hacía mucho
más visible porque entran muchas de golpe.

Pendiente: la **pantalla de revisión** en la app. Hoy no existe ninguna pantalla de compras —
las `PurchaseInvoice` se cargan por API—, así que no es "una pantalla más" sino la sección de
compras entera. Queda para cuando se decida hacerla.

### E.2 🟢 Servicios ARCA de nicho

Existen pero los dejaría para el final, salvo que aparezca un usuario que los pida:

- `wsmtxca` — facturación con detalle de ítems informado a ARCA (no sólo totales).
- `wsbfev1` — bonos fiscales electrónicos.
- `wsct` — comprobantes de turismo (reintegro a turistas extranjeros).
- `ws_sr_padron_a4 / a5 / a10` — otros alcances de padrón.

---

## Orden sugerido

1. **A.1** concepto servicios — está declarado en el schema y no funciona.
2. **A.2 + A.3** exentos, no gravados y tributos — desbloquean B2B real.
3. **B** padrón — mejor valor/esfuerzo, mejora la UX de todo el flujo.
4. **A.4 + A.5** cotización y tablas de parámetros.
5. **D.1** reconciliación — antes de tener volumen, no después.
6. **C.1** Factura M — barato y desbloquea un tipo de emisor entero.
7. **C.3** (WSFEX) — hecho.
8. **E.1** importación de compras.

Las fases A, D y E.1 **no dependen de ARCA homologación**: se pueden desarrollar y testear con
mocks. Las fases B y C sí requieren el trámite de asociación de servicio al certificado
(bloqueante 1.1 de `docs/roadmap.md`), y cada servicio nuevo es un trámite aparte — conviene
pedirlos todos juntos cuando se haga el de `wsfe`.
