# Cobertura de la integración con ARCA

Qué servicios y qué operaciones de ARCA usa hoy Chirola, y qué falta. El protocolo en sí está
explicado en [`arca-integracion.md`](arca-integracion.md); el backlog de producto, en
[`roadmap.md`](roadmap.md).

## Lo que está integrado

| Servicio | Para qué |
| :--- | :--- |
| **WSAA** | autenticación: login ticket, firma CMS y cache del TA |
| **WSFEv1** | facturación de mercado interno |
| **WSFEX** | comprobantes de exportación (tipos 19, 20 y 21) |
| **ws_sr_padron_a13** | consulta de contribuyentes por CUIT |

Operaciones de WSFEv1 en uso (`services/api/src/arca/wsfe/wsfe.service.ts`): `FEDummy`,
`FECAESolicitar`, `FECompUltimoAutorizado`, `FECompConsultar`, `FEParamGetPtosVenta`,
`FEParamGetTiposCbte`, `FEParamGetTiposIva`, `FEParamGetCotizacion`.

Comprobantes emitibles: factura, nota de crédito y nota de débito en las letras **A, B y C**
(códigos 1-3, 6-8, 11-13), **M** (51-53) y **FCE MiPyME** (201-213), más los de exportación.

Del comprobante se modela todo lo que el régimen pide: concepto (productos, servicios o ambos,
con fechas de servicio), importes exentos y no gravados, tributos —percepciones y retenciones—,
moneda extranjera con cotización, y comprobantes asociados para las NC/ND.

## Factura M

Los emisores nuevos a los que ARCA no acredita capacidad económica **sólo pueden emitir M** en
lugar de A: sin esto, un emisor recién dado de alta directamente no puede facturar.

## Reconciliación

Si la app pierde una emisión —timeout con el CAE ya otorgado del otro lado—, `FECompConsultar`
la recupera en vez de emitir un comprobante nuevo. Las llamadas SOAP quedan registradas para
soporte, que es lo que permite reconstruir qué pasó cuando ARCA contesta algo raro.

## Lo que falta

**Servicios de nicho**, sólo si aparece alguien que los pida: `wsmtxca` (factura con detalle de
ítems informado a ARCA, no sólo totales), `wsbfev1` (bonos fiscales), `wsct` (comprobantes de
turismo) y los otros alcances de padrón (`a4`, `a5`, `a10`).

**Cada servicio nuevo es un trámite aparte** ante ARCA: hay que asociarlo al certificado en el
Administrador de Relaciones. Si alguna vez se hace uno, conviene pedir todos los que se prevean
de una sola vez.
