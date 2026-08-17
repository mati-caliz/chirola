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

### A.1 🔴 Concepto "servicios" y "productos y servicios"

`issueVoucherSchema` acepta `concept: 1 | 2 | 3`, pero el detalle nunca incluye
`FchServDesde`, `FchServHasta` ni `FchVtoPago`. ARCA los exige cuando `Concepto` es 2 o 3, y
rechaza con **error 10016 / 10017** si faltan. En la práctica hoy sólo funciona el concepto 1.

Reglas del protocolo:

- `Concepto = 1` (productos): los tres campos deben **omitirse**.
- `Concepto = 2` (servicios) y `3` (productos y servicios): los tres son **obligatorios**,
  formato `AAAAMMDD`.
- `FchServDesde <= FchServHasta`.
- `FchVtoPago` es la fecha de vencimiento del pago; para comprobantes de contado se usa la
  misma fecha del comprobante.

Trabajo:

- Agregar `servicePeriod` (`from`, `to`, `paymentDueDate`) a `issueVoucherSchema`, condicional
  al concepto vía `superRefine`.
- Propagarlo por `CaeRequest` y emitirlo en `buildDetail`.
- Persistir el período en `Voucher` (migración: tres columnas `DateTime?`).
- Mostrarlo en el PDF (los comprobantes de servicios deben exhibir el período facturado).
- Selector de concepto + rango de fechas en la pantalla de nueva factura.

Criterio de aceptación: emitir una Factura C de servicios en homologación y obtener CAE.

### A.2 🔴 Importes exentos y no gravados

`ImpTotConc` (no gravado), `ImpOpEx` (exento) e `ImpTrib` están **hardcodeados en `0`**.
Consecuencia: no se puede facturar un ítem exento ni uno no gravado, y la suma no cierra si el
usuario lo intenta.

Notar la asimetría: `PurchaseInvoice` ya tiene `exempt` y `untaxed` en Prisma, pero `Voucher` no.

Reglas del protocolo:

- `ImpTotal = ImpTotConc + ImpNeto + ImpOpEx + ImpIVA + ImpTrib`. ARCA valida la identidad y
  rechaza con **error 10048** si no cierra (tolerancia de redondeo muy chica).
- Un ítem exento no lleva entrada en el array `Iva`; uno gravado a 0% sí (alícuota id 3).
  Son cosas distintas y se confunden seguido.
- En Factura C (monotributo) `ImpNeto` es el total y no se informa `Iva`.

Trabajo:

- Extender `itemSchema` con una clasificación explícita (`TAXED` / `EXEMPT` / `UNTAXED`) en vez
  de inferirla de la alícuota.
- Ajustar `iva-calculator.ts` para acumular las tres bases por separado.
- Migración en `Voucher`: `exemptAmount`, `untaxedAmount`, `tributeAmount`.
- Tests de la identidad de totales en `iva-calculator.spec.ts`.

### A.3 🔴 Tributos (percepciones y retenciones)

Falta el nodo `<Tributos>`. Sin él no se pueden emitir comprobantes con percepción de IIBB,
percepción de IVA, impuestos internos ni tasas municipales — algo muy común en B2B.

Estructura por tributo: `Id`, `Desc`, `BaseImp`, `Alic`, `Importe`. La suma de los `Importe`
debe igualar `ImpTrib`.

Tipos (vía `FEParamGetTiposTributos`, se cachean): 1 nacionales · 2 provinciales ·
3 municipales · 4 internos · 99 otros.

Trabajo:

- Nuevo tipo `Tribute` en `packages/shared`, array opcional en `issueVoucherSchema`.
- `buildTributes` en `wsfe.service.ts`, análogo a `buildAssociatedVouchers`.
- Persistir en `Voucher` (Json, como `associatedVouchers`) y renderizar en el PDF.

### A.4 🟡 Cotización de moneda extranjera

Se envían `MonId` y `MonCotiz` pero nunca se consulta `FEParamGetCotizacion`. El usuario tendría
que tipear la cotización a mano y ARCA la valida contra la suya (**error 10051** si difiere).

Regla: la cotización a usar es la del **día hábil anterior** a la fecha del comprobante.

Trabajo: método `getExchangeRate(currencyId, date)` en `wsfe.service.ts`, endpoint que lo
exponga, y prellenado del campo en la app con opción a override.

### A.5 🟢 Completar los `FEParamGet*`

Hoy sólo se consultan `PtosVenta` y `TiposCbte`; el resto de las tablas está hardcodeado en
`packages/shared` (`ivaRateAfipId`, `DocumentType`, `RecipientIvaCondition`). Funciona, pero se
desincroniza cuando ARCA cambia una tabla.

Faltan: `FEParamGetTiposIva`, `FEParamGetTiposDoc`, `FEParamGetTiposMonedas`,
`FEParamGetTiposTributos`, `FEParamGetTiposOpcional`, `FEParamGetCondicionIvaReceptor`.

Sugerencia: cachearlos en DB con TTL largo (ya existe el patrón en `AccessTicketCache`) y usar
las constantes de `shared` como fallback, no como fuente de verdad.

---

## Fase B — 🟡 Padrón: consulta de contribuyentes por CUIT

La mejor relación valor/esfuerzo de todo el doc. Autocompletar razón social, condición frente al
IVA y domicilio a partir del CUIT, en vez de que el usuario los tipee.

Dos servicios, distinto alcance:

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

Trabajo:

- `services/api/src/arca/padron/padron.service.ts` reusando `arca-soap.util.ts`.
- `GET /issuers/:issuerId/padron/:cuit` → datos normalizados del contribuyente.
- Prellenado en el alta de `Client` y en el receptor de la nueva factura.
- Validar la `CondicionIVAReceptorId` contra el padrón antes de emitir: hoy viene del cliente y
  un valor incoherente con la letra del comprobante es causa frecuente de rechazo.
- Cachear la respuesta (los datos de padrón cambian poco; TTL de días).

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

### D.1 🟡 Reconciliar contra ARCA lo que la app perdió

Hoy hay reintento (`voucher-retry.scheduler.ts`) y bloqueo por emisor (`issuer-lock.service.ts`),
pero si se corta la red **después** de que ARCA otorgó el CAE, el comprobante queda emitido en
ARCA y `PENDIENTE` en la DB. El reintento lo duplicaría o chocaría con la numeración.

Solución: antes de reintentar, consultar `FECompConsultar` con el número tentativo y, si ya
existe con ese CAE, adoptarlo en vez de re-emitir. `FECompTotXRequest` da el máximo de registros
por request, útil si más adelante se hace emisión en lote.

Un job de reconciliación periódica que compare `FECompUltimoAutorizado` contra el último número
en DB por punto de venta detecta desincronizaciones antes de que rompan una emisión.

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
3. **B** padrón — mejor valor/esfuerzo, mejora la UX de todo el flujo.
4. **A.4 + A.5** cotización y tablas de parámetros.
5. **D.1** reconciliación — antes de tener volumen, no después.
6. **C.1** Factura M — barato y desbloquea un tipo de emisor entero.
7. Decidir entre **C.2** (FCE MiPyME) y **C.3** (WSFEX) según a qué usuario se le vende.
8. **E.1** importación de compras.

Las fases A, D y E.1 **no dependen de ARCA homologación**: se pueden desarrollar y testear con
mocks. Las fases B y C sí requieren el trámite de asociación de servicio al certificado
(bloqueante 1.1 de `docs/roadmap.md`), y cada servicio nuevo es un trámite aparte — conviene
pedirlos todos juntos cuando se haga el de `wsfe`.
