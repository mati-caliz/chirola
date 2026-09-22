# Arquitectura de Chirola

App mobile para operar ARCA de forma simple, empezando por facturación electrónica. El backend
intermedio es obligatorio por dos razones: custodia los certificados —que nunca pueden viajar al
teléfono— y ARCA expone SOAP, que no es algo que se consuma desde un cliente móvil.

Chirola es además el **backend fiscal de otras apps propias**: respondi y gastronova emiten a
través de su API v1 en vez de reimplementar WSAA y WSFEv1 cada una.

## Componentes

### `apps/mobile` — Expo + React Native

Expo SDK 54 con expo-router, navegación por grupos `(auth)` y `(app)` con guard de sesión en el
layout raíz. Los datos van con React Query, los tokens en `expo-secure-store` y el cliente
(`lib/api.ts`) rota el refresh token solo ante un 401. La base se configura con
`EXPO_PUBLIC_API_URL`.

Las pantallas cubren el ciclo entero: login y registro, alta y detalle de emisores, onboarding
del certificado (genera el CSR, lo copia y empareja el `.crt`), ABM de clientes, emisión con
ítems e IVA, el detalle con CAE y QR, el envío del PDF por mail o por cualquier app, la nota de
crédito desde el detalle, la cola de comprobantes sin CAE y el Libro IVA Ventas del mes.

El mail sale del teléfono con `expo-mail-composer`, desde la cuenta de quien factura, y no
desde un servidor de Chirola: el comprobante lo manda el emisor, y así no hay SMTP propio que
mantener ni reputación de dominio que cuidar.

### `services/api` — NestJS + Prisma + PostgreSQL

| Módulo | Qué hace |
| :--- | :--- |
| `auth` | usuarios de la app: JWT de acceso corto y refresh token opaco rotativo |
| `issuers` | el contribuyente: CUIT, condición frente al IVA, puntos de venta |
| `certs` | el vault cifrado, la generación del CSR y el emparejamiento del `.crt` |
| `arca/wsaa` | login ticket, firma CMS y cache del TA |
| `arca/wsfe` | el cliente SOAP de WSFEv1 |
| `arca/padron` | consulta de contribuyentes por CUIT |
| `vouchers` | el dominio fiscal: numeración, emisión, persistencia auditada, PDF y QR |
| `clients` | receptores por emisor, en rutas anidadas bajo `/issuers/:issuerId/clients` |
| `fiscal` | posición de IVA, vencimientos y Libro IVA Ventas (JSON y CSV) |
| `notifications` | tokens de push por usuario y envío por el servicio de Expo |

### `packages/shared` — TypeScript + Zod

Los tipos y las validaciones que comparten front y back: payloads de emisión, enums de tipos de
comprobante, de IVA y de documento. Se definen una sola vez acá.

## Modelo de datos

`User`, `Issuer` (un usuario tiene N emisores, uno por CUIT), `Certificate` (por emisor,
cifrado), `SalesPoint`, `Client`, `Voucher` (con CAE, QR y estado de ARCA) y `VoucherItem`.
`Voucher` guarda el documento y el nombre del receptor tal como se emitió, y se vincula con el
`Client` del mismo documento si existe; los comprobantes anteriores a 2026-09-22 no tienen esas
columnas y el receptor se lee del QR.
Para el lado servicio: `ApiClient` (un consumidor con su key), `ApiClientIssuer` (a qué emisores
accede) y `ServiceAuditLog`.

## Las decisiones que conviene conocer

### El entorno de ARCA es por emisor, no global

`Issuer.environment` es lo que decide si se habla con homologación o con producción, y viaja por
`AuthContext.environment`. Antes se leía una variable global `ARCA_ENV`, así que toda la
instancia apuntaba a un solo lado: un certificado productivo contra el WSAA de homologación
falla con `cms.cert.untrusted`, que parece un problema del certificado y no lo es. Los emisores
de prueba conviven con los productivos.

### El certificado se genera acá, pero el trámite es humano

`POST /issuers/:id/csr` genera la clave RSA 2048 y el CSR con el subject exacto que exige ARCA
(`C=AR, O=<razón social>, CN=<alias>, serialNumber=CUIT <cuit>`), y guarda la clave privada
cifrada: **nunca sale del backend**. `PUT /issuers/:id/certificate` empareja el `.crt` que
devuelve ARCA, validando que la clave pública coincida con la del par generado.

Lo que ninguna API puede saltear: alguien tiene que subir el CSR al sitio de ARCA, descargar el
`.crt`, asociar el servicio `wsfe` en el Administrador de Relaciones y registrar el punto de
venta.

### Un API client no es un usuario

`Issuer.userId` es obligatorio, pero un `ApiClient` no puede ser un `User`. Cada API client tiene
entonces un **usuario de servicio** implícito (`<apiClientId>@service.chirola.internal`) que se
crea solo la primera vez y es dueño de los emisores dados de alta por API. No puede loguearse:
su `password` no tiene el formato `scrypt$salt$hash` que exige `verifyPassword`, así que la
comparación siempre falla. Como efecto secundario, el `@@unique([userId, cuit, environment])`
que ya existía garantiza un emisor por CUIT y entorno para cada API client, sin constraints
nuevas.

### Emitir tiene tres desenlaces, no dos

Éxito, `ArcaRejectionError` (rechazo real de ARCA) y `VoucherQueuedException`, que sale como HTTP
503 con `status: "PENDIENTE"` y un `pendingVoucherId`. **El tercero no es un error**: significa
encolado, y `VoucherRetryScheduler` reintenta. Tratarlo como fallo lleva a refacturar algo que ya
se emitió. La emisión toma un lock por emisor para que dos pedidos simultáneos no consuman dos
números, y es idempotente por clave de request.

Lo encolado se ve en `GET /issuers/:issuerId/pending-vouchers`. Sólo un comprobante `FAILED` se
puede reintentar o descartar: uno `PENDING` puede estar en pleno reintento y ya tener CAE en
ARCA, y descartarlo dejaría un comprobante autorizado sin registrar. El reintento manual pasa
por el mismo camino que el automático, que primero consulta si ARCA ya había autorizado el
número intentado.

### Notas de crédito y débito

Las NC/ND aceptan `associatedVouchers` y se serializan como `<ar:CbtesAsoc>`, que en el XSD de
WSFEv1 va **después** de `CondicionIVAReceptorId` y **antes** de `Iva`: fuera de ese orden ARCA
rechaza el XML. El schema exige al menos un asociado, y los asociados se persisten en
`Voucher.associatedVouchers` para auditoría.

`GET /vouchers/:id/credit-note-draft` arma en el backend la NC de la misma letra con el asociado,
el receptor y los ítems del original. Los otros tributos no se copian: se guardan como
descripción e importe, sin la base ni la alícuota que pide la emisión.

### Auth

Access token JWT corto (`JWT_ACCESS_TTL`, por defecto 1 h) y refresh token opaco guardado
hasheado con sha256 (`REFRESH_TOKEN_TTL_DAYS`, 30 días). `POST /auth/refresh` **rota**: revoca el
usado y emite un par nuevo, así que reusar uno viejo da 401. `POST /auth/logout` es idempotente.

`register` y `login` cortan con 429 después de 10 intentos por email cada 15 minutos, y
`refresh` después de 60 por IP. Se cuenta por email porque la API no tiene ruta pública y la IP
que ve es la del contenedor que llama. Si se publica detrás de `proxy-nginx`, hay que definir
`TRUST_PROXY=172.19.0.254`, que es la IP fija del proxy en `shared-nginx`. Confiar en toda la
subred no sirve, porque cualquier otro contenedor de esa red podría falsificar
`X-Forwarded-For`.

### Rotar `CERT_ENCRYPTION_KEY`

La clave cifra las claves privadas de los certificados. Para cambiarla:

1. Generar la nueva con `openssl rand -base64 32` y agregarla al `.env` como
   `CERT_ENCRYPTION_KEY_NEW`, sin tocar la actual.
2. Frenar la API (`docker compose -f docker-compose.prod.yml stop api`): mientras corre con la
   clave vieja, no puede leer lo que ya se recifró.
3. Simular: `run --rm --build api-tools ./node_modules/.bin/ts-node scripts/rotate-cert-encryption-key.ts`.
   Descifra cada clave con la actual y la recifra con la nueva, sin escribir.
4. Aplicar con `--apply`, que escribe todo en una sola transacción.
5. En el `.env`, reemplazar `CERT_ENCRYPTION_KEY` por el valor nuevo, borrar
   `CERT_ENCRYPTION_KEY_NEW` y levantar la API.

Un dump anterior a la rotación sólo se lee con la clave vieja. El backup offsite guarda el
`.env` de cada día junto con su dump, así que una restauración usa la clave de ese mismo día.

## Verificar sin emitir

`POST /api/v1/vouchers/dry-run` consulta `FECompUltimoAutorizado` contra ARCA real y devuelve el
próximo número sin generar ningún comprobante fiscal. Es la forma de validar un certificado
productivo sin consumir numeración. La app usa `POST /api/vouchers/dry-run` para mostrar el
número y el total antes de confirmar, y `POST /api/vouchers/amounts` para el total en vivo
mientras se cargan ítems: acepta un borrador sin descripciones ni receptor, así que el total
aparece antes de que el comprobante sea emitible. Si falla, igual deja emitir, porque el número lo asigna
ARCA al autorizar.

`GET /issuers/:id/arca-health` pregunta `FEDummy` y cachea la respuesta un minuto por entorno,
para que abrir la pantalla de emisión no le pegue a ARCA cada vez.

El detalle del protocolo está en [`arca-integracion.md`](arca-integracion.md) y la cobertura
actual de WSFEv1 en [`arca-ampliacion.md`](arca-ampliacion.md). Lo que falta, en
[`roadmap.md`](roadmap.md).
