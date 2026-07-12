# Chirola como plataforma fiscal (ARCA-as-a-Service)

Plan para que Chirola deje de ser sólo la app mobile y pase a ser el **servicio central de
integración ARCA** que consumen otras apps propias (primer consumidor: Gastronova), sin que cada
una reimplemente WSAA/WSFEv1.

Doc espejo del lado consumidor: `gastronova/docs/chirola-migration-plan.md`.

## 1. Objetivo

Un único backend que custodia certificados y habla con ARCA, expuesto como API HTTP/JSON
multi-tenant y versionada. Las apps clientes (mobile de Chirola, Gastronova, futuras) no ven claves
privadas ni SOAP: mandan un comprobante y reciben CAE.

```
App mobile Chirola ─┐
Gastronova (Java)  ─┼─HTTPS/JSON─► Chirola API ─SOAP─► ARCA (WSAA + WSFEv1)
Futuras apps       ─┘              (vault de certs, idempotencia, retries)
```

## 2. Principio rector de secuencia (no negociable)

**Hoy Gastronova es la implementación fiscal más madura** (~4.650 LOC probadas en producción, con
recuperación de duplicados, retries, monitor de certs). Chirola es un MVP. Por lo tanto:

> No se migra ningún tráfico real de Gastronova hasta que Chirola **iguale y supere** la
> confiabilidad de Gastronova y lo demuestre en *shadow mode*. Migrar antes sería reemplazar algo
> probado por algo verde en el terreno menos tolerante a errores (emisión legal de CAE).

## 3. Estado actual de Chirola

Ya implementado en `services/api`:

- WSAA `loginCms` con cache de TA por `(cuit, service)` — **en memoria** (`Map`).
- WSFEv1: `requestCae` (FECAESolicitar), `getLastAuthorized` (FECompUltimoAutorizado), `ping`.
- Vault de certificados: clave privada cifrada (`FieldEncryptionService`), `certPem`, `validUntil`.
- Generación de CSR y armado de par de claves (`CertsService`, `node-forge`).
- Cálculo de IVA (`iva-calculator`), QR (RG 4291) y PDF del comprobante.
- Modelo multi-emisor: `Issuer` (con `issuerId` scope), `SalesPoint`, `Client`, `Voucher`, `VoucherItem`.
- Auth de **usuario final** (JWT + refresh tokens).

## 4. Gap analysis: Chirola vs Gastronova

### 4.1 Núcleo fiscal (bloqueante para migrar)

| Capacidad | Gastronova | Chirola | Acción |
|-----------|:----------:|:-------:|--------|
| FECAESolicitar (CAE) | ✅ | ✅ | — |
| FECompUltimoAutorizado | ✅ | ✅ | — |
| **FECompConsultar** (consulta de comprobante emitido) | ✅ | ❌ | **Agregar** |
| **Recuperación de duplicados** (timeout con CAE ya emitido → consulta y recupera) | ✅ | ❌ | **Agregar** |
| **Idempotencia** (misma request no emite dos CAE) | ✅ (lock + recovery) | ❌ | **Agregar** |
| **Lock de concurrencia por emisor** (evita doble numeración) | ✅ (striped locks) | ❌ | **Agregar** |
| **TA compartido entre instancias** (persistido, apto HA) | ✅ (DB) | ❌ (memoria por réplica) | **Agregar** |
| **Retry scheduler** de comprobantes fallidos (backoff, `retryCount`) | ✅ | ❌ | **Agregar** |
| **Monitor de expiración de certificados** (scheduled) | ✅ | ❌ | **Agregar** |
| Param service: `FEParamGetPtosVenta`, detección de condición fiscal | ✅ | ❌ | **Agregar** |
| Preview de comprobante (calcular sin emitir) | ✅ | ❌ | Agregar |
| Onboarding CSR → upload cert | ✅ | ✅ (parcial) | Revisar paridad |
| Validación de CUIT | ✅ | parcial (Zod) | Consolidar |

### 4.2 Módulos de negocio fiscal (deseables, no bloqueantes para el primer flujo)

| Módulo | Gastronova | Chirola | ¿Va al servicio? |
|--------|:----------:|:-------:|------------------|
| Facturas de compra (CRUD + dashboard) | ✅ | ❌ | Sí (afecta posición IVA) |
| Posición mensual de IVA (ventas + compras) | ✅ | ❌ | Sí |
| Calendario de vencimientos AFIP | ✅ | ❌ | Sí (dato fiscal, no de la app) |
| Alertas fiscales (venc. + cert) | ✅ | ❌ | Servicio calcula, app notifica |

### 4.3 Lo que NO va al servicio (queda en cada app)

Presentación y orquestación de negocio propia de la app: disparo de auto-facturación al cerrar una
orden, envío de comprobante por email/WhatsApp, POS, layout del PDF con branding, notificaciones
push. El servicio expone datos y emite; **cada app decide cuándo y cómo**.

## 5. Arquitectura destino

### 5.1 Autenticación máquina-a-máquina

Hoy Chirola sólo tiene auth de usuario final. Para servir a otras apps hace falta una identidad de
**tenant de servicio** separada del `User`:

- Nuevo modelo `ApiClient` (o `ServiceTenant`): `id`, `name` (ej. "gastronova"), `apiKeyHash`,
  `scopes`, `active`. Autenticación por **client credentials / API key** (header
  `Authorization: Bearer <key>` o `X-Api-Key`), distinta del JWT de usuario.
- Un `ApiClient` puede operar sobre uno o varios `Issuer`. El `issuerId` **sigue derivándose del
  contexto autenticado**, nunca de un parámetro libre del cliente (regla de aislamiento vigente).
- Guard `ServiceAuthGuard` en paralelo al `JwtAuthGuard`. Los endpoints de plataforma aceptan
  ambos según el consumidor.

### 5.2 Idempotencia (la pieza más crítica)

El CAE es legal e irreversible: emitir dos veces por un reintento es inaceptable.

- Header `Idempotency-Key` obligatorio en `POST /vouchers`.
- Tabla `IdempotencyRecord`: `(apiClientId, key)` único → guarda el resultado. Segunda llamada con
  la misma key devuelve el resultado guardado, no reemite.
- **Recuperación de duplicados**: si ARCA devuelve error de duplicado o la request corta por
  timeout, consultar con `FECompConsultar` por `(ptoVta, tipo, número)` y recuperar el CAE ya
  emitido en vez de fallar. (Portar `requestCaeWithDuplicateRecovery`/`tryRecoverIssuedInvoice` de
  Gastronova.)
- **Lock por emisor** al reservar número + emitir, para que dos requests concurrentes del mismo
  `issuerId` no pisen la numeración (portar los striped locks; en multi-instancia, lock distribuido
  vía Postgres advisory lock).

### 5.3 Alta disponibilidad

- **TA persistido** en DB (nueva tabla `AccessTicketCache` por `(issuerId, service)`), no en `Map`
  de proceso: varias réplicas comparten el TA y no re-piden a WSAA (ARCA bloquea si se abusa).
- Emisión **stateless** salvo el lock; escalar horizontalmente el API.
- Retry scheduler idempotente y con lock para no duplicar reintentos entre réplicas.

### 5.4 Notificación asíncrona (webhooks)

Para flujos donde la app no espera sincrónicamente (auto-facturación, resultado de un retry):

- El `ApiClient` registra un `webhookUrl` + secret.
- Eventos: `voucher.issued`, `voucher.failed`, `voucher.retry_exhausted`, `certificate.expiring`.
- Firma HMAC del payload; reintentos con backoff. Gastronova expone un endpoint receptor.

### 5.5 Contrato público versionado

- Prefijo `/(v1)` en las rutas de plataforma; el contrato vive en `packages/shared` (schemas Zod)
  como fuente de verdad. Gastronova (Java) genera/mantiene sus DTOs a partir de ese contrato.
- Cambios incompatibles → nueva versión, nunca romper `v1` en caliente.

### 5.6 Observabilidad y auditoría

- Log de auditoría por `ApiClient` + `issuerId` de cada emisión (request, respuesta ARCA, CAE).
- Rate limiting por `ApiClient`. Métricas de latencia y tasa de error contra ARCA.

## 6. Roadmap por fases

Cada fase deja Chirola desplegable y no rompe la app mobile existente.

### F0 — Endurecer el núcleo fiscal (bloqueante)
Sin esto no se sirve a nadie externo con seguridad.
1. `FECompConsultar` en `WsfeService`.
2. Idempotencia: header `Idempotency-Key`, tabla `IdempotencyRecord`, recuperación de duplicados.
3. Lock de emisión por `issuerId` (advisory lock de Postgres).
4. TA persistido en DB compartido entre réplicas.
5. Tests de concurrencia (dos emisiones simultáneas → un solo número/CAE).

### F1 — Capa de plataforma (multi-tenant service)
1. Modelo `ApiClient` + `ServiceAuthGuard` + emisión/rotación de API keys.
2. Versionado `/v1` de los endpoints de emisión y consulta.
3. Rate limiting + auditoría por `ApiClient`.
4. Documentar el contrato en `packages/shared` y publicarlo.

### F2 — Resiliencia operativa
1. Retry scheduler con `retryCount`/`nextRetryAt` y lock entre réplicas.
2. Monitor de expiración de certificados (scheduled) + evento `certificate.expiring`.
3. Webhooks (`voucher.*`, `certificate.*`) con firma HMAC y reintentos.

### F3 — Paridad de features fiscales
1. Param service: `FEParamGetPtosVenta`, detección de condición fiscal, preview de comprobante.
2. Facturas de compra (modelo + endpoints).
3. Posición mensual de IVA (ventas + compras).
4. Calendario de vencimientos AFIP + alertas fiscales.

### F4 — Shadow mode con Gastronova
1. Gastronova sigue emitiendo con su código Java **y** espeja cada request a Chirola (sin usar su
   CAE para nada legal todavía).
2. Comparar resultados (CAE, numeración, montos, IVA) y medir latencia/errores.
3. Corregir discrepancias hasta convergencia sostenida (ej. N días sin diferencias).

### F5 — Cutover incremental
1. Migrar **sólo el flujo de venta (emisión de CAE)** de Gastronova a Chirola; compras/IVA/alertas
   quedan en Java hasta probarse.
2. Feature flag por restaurante para activar Chirola gradualmente y poder revertir.
3. Migrar el resto de módulos una vez estable.

### F6 — Plataforma general
Generalizar a nuevos consumidores y nuevos servicios ARCA/AFIP (padrón/constancia de inscripción,
otros web services), self-service de onboarding de apps clientes.

## 7. Estrategia de migración: shadow mode

El *shadow mode* (F4) es el mecanismo que baja el riesgo a casi cero: se prueba Chirola con tráfico
real **sin consecuencias legales** porque el CAE que vale sigue siendo el de Gastronova. Sólo cuando
Chirola produce sistemáticamente el mismo resultado se corta. Ver detalle del lado consumidor en
`gastronova/docs/chirola-migration-plan.md`.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Doble emisión de CAE por reintento | Idempotency-Key + FECompConsultar + lock por emisor (F0) |
| Chirola caído deja a Gastronova sin facturar | HA + circuit breaker y degradación con gracia del lado Gastronova; retries |
| Regresión fiscal vs. Java probado | Shadow mode con comparación antes del cutover (F4) |
| Radio de explosión de seguridad (Chirola custodia claves de varios negocios) | Cifrado de claves ya existente + aislamiento por `issuerId` + auditoría + rotación de API keys |
| Bloqueo de WSAA por pedir TA de más | TA persistido y compartido entre réplicas (F0) |
| Doble reintento entre réplicas del scheduler | Lock distribuido en el scheduler (F2) |

## 9. Endpoints de plataforma (contrato `v1`, borrador)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/v1/vouchers` | Emitir comprobante y obtener CAE (requiere `Idempotency-Key`) |
| `GET` | `/v1/vouchers/:id` | Consultar comprobante emitido |
| `POST` | `/v1/vouchers/preview` | Calcular totales/IVA sin emitir |
| `GET` | `/v1/sales-points` | Puntos de venta (FEParamGetPtosVenta) |
| `POST` | `/v1/issuers/:id/csr` | Generar CSR para el certificado |
| `POST` | `/v1/issuers/:id/certificate` | Subir certificado firmado por ARCA |
| `GET` | `/v1/fiscal/iva-position` | Posición mensual de IVA |
| `GET` | `/v1/fiscal/vencimientos` | Próximos vencimientos AFIP |
| `POST` | `/v1/purchase-invoices` | Registrar factura de compra |

Todos derivan `issuerId` del `ApiClient` autenticado, nunca de un parámetro libre del cliente.
