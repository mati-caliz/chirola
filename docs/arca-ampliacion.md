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

Pendiente: usar el padrón para **validar** la `CondicionIVAReceptorId` antes de emitir. Hoy sólo
la prellena; un valor incoherente con la letra del comprobante sigue siendo causa de rechazo.

Pendiente también: prellenado en el alta de `Client` (hoy sólo está en la nueva factura).

---

## Fase C — 🟡 Más tipos de comprobante

### C.1 🟡 Factura M (códigos 51, 52, 53)

Los emisores nuevos cuya capacidad económica ARCA no acredita **sólo pueden emitir M** en lugar
de A. Hoy la app no las contempla: ese emisor simplemente no puede facturar.

Particularidades: la M lleva la leyenda de retención y el receptor actúa como agente de
retención de IVA y ganancias. `inferFiscalCondition` en `packages/shared` debe reconocer el caso
(el emisor tiene habilitado 51 pero no 1).

### C.2 🟡 FCE MiPyME (códigos 201-213)

Factura de Crédito Electrónica, **obligatoria** para operaciones de PyME con empresas grandes
por encima de cierto monto. Mercado concreto y bien definido.

Requiere el nodo `<Opcionales>` que hoy no existe:

- Id `2101` — **CBU** del emisor donde se cobra.
- Id `27` — tipo de transmisión (`SCA` sistema de circulación abierta / `ADC` agente de depósito
  colectivo).
- Id `22` — para la anulación.

Además: las NC/ND asociadas a una FCE tienen sus propios códigos (202-213), y el plazo de pago
es un dato obligatorio del comprobante.

Trabajo: `<Opcionales>` genérico en `buildDetail`, CBU en el modelo `Issuer`, códigos nuevos en
`VoucherType` / `voucherTypeName`, y ajuste de `voucherLetter` (hoy parsea la letra del nombre
con un regex `[ABC]` que no cubre M ni FCE — revisar).

### C.3 🟡 Exportación — WSFEX (tipos 19, 20, 21)

Facturación de exportación. Muy relevante para exportadores de servicios (software, freelance
facturando al exterior), que es exactamente el perfil de usuario de la app.

Es un **servicio SOAP distinto** (`wsfex`), no una extensión de WSFEv1: otro WSDL, otro set de
operaciones (`FEXAuthorize`, `FEXGetCMP`, `FEXGetLast_CMP`, `FEXGetPARAM_*`), y un ticket WSAA
propio (servicio `wsfex`, con su propia asociación de certificado en ARCA).

Diferencias de negocio a modelar:

- Sin IVA (operación de exportación).
- Receptor sin CUIT argentino: se identifica con país, tipo de documento extranjero y
  domicilio del exterior.
- Campos propios: Incoterms, idioma del comprobante, permiso de embarque (para bienes),
  destino, forma de pago.
- El resultado es un **CAE de exportación**, con su propia validación.

Es la fase más grande del doc. Vale la pena sólo si el perfil exportador es objetivo de negocio.

---

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

### D.2 🟢 Registro de las llamadas SOAP

Guardar request/response de cada llamada a ARCA (ya existe `ServiceAuditLog` como base) para
poder diagnosticar un rechazo sin reproducirlo. Los rechazos de ARCA traen códigos numéricos
cuyo significado hay que rastrear; sin el XML original el soporte es a ciegas.

Cuidado: el XML de WSAA contiene el ticket firmado — hay que redactarlo antes de persistir.

### D.3 🟢 Estados de `Voucher` como enum tipado

`status` es string libre con valor en español (`"PENDIENTE"`), en contra de la regla de naming
del proyecto. Migrar a enum compartido (`PENDING` / `APPROVED` / `OBSERVED` / `REJECTED`).
Encaja acá porque los estados nuevos que trae la reconciliación (`RECOVERED`) necesitan el enum.

---

## Fase E — 🟢 Compras y otros servicios

### E.1 🟢 Importación de "Mis Comprobantes"

Las `PurchaseInvoice` se cargan **a mano**. ARCA no expone API pública de Mis Comprobantes, pero
sí permite exportar CSV/XLS desde el portal. Un importador de ese archivo convierte la app de
"facturador" a "libro IVA completo" sin depender de un servicio nuevo.

Trabajo: parser del CSV de ARCA, matcheo contra `PurchaseInvoice` existentes por
`(supplierCuit, invoiceType, salesPoint, number)` para no duplicar, y pantalla de revisión antes
de confirmar la importación.

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
3. **B** padrón — mejor valor/esfuerzo, mejora la UX de todo el flujo. ← siguiente
4. **A.4 + A.5** cotización y tablas de parámetros.
5. **D.1** reconciliación — antes de tener volumen, no después.
6. **C.1** Factura M — barato y desbloquea un tipo de emisor entero.
7. Decidir entre **C.2** (FCE MiPyME) y **C.3** (WSFEX) según a qué usuario se le vende.
8. **E.1** importación de compras.

Las fases A, D y E.1 **no dependen de ARCA homologación**: se pueden desarrollar y testear con
mocks. Las fases B y C sí requieren el trámite de asociación de servicio al certificado
(bloqueante 1.1 de `docs/roadmap.md`), y cada servicio nuevo es un trámite aparte — conviene
pedirlos todos juntos cuando se haga el de `wsfe`.
