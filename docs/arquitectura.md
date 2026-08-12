# Arquitectura de Chirola

## Visión

App mobile multiplataforma para operar ARCA de forma simple, empezando por facturación
electrónica. Backend intermedio obligatorio por seguridad (custodia de certificados) y porque
ARCA expone SOAP, no una API apta para consumir desde un cliente móvil.

## Componentes

### `apps/mobile` — Expo + React Native (TypeScript)
- Navegación, auth de usuario (JWT contra el backend).
- Onboarding del certificado (guía + upload del `.crt`).
- ABM de clientes/receptores.
- Formulario de emisión (tipo de comprobante, receptor, ítems, IVA) → CAE + PDF/QR.
- Listado e historial de comprobantes.

### `services/api` — NestJS + Prisma + PostgreSQL
Módulos:
- `auth` — usuarios de la app (registro/login, JWT + refresh tokens rotativos, logout).
- `emisores` — datos del contribuyente (CUIT, condición IVA, puntos de venta).
- `certs` — vault cifrado; generación de CSR; carga del `.crt`.
- `arca/wsaa` — LTR + firma CMS + cache del TA.
- `arca/wsfe` — cliente SOAP de WSFEv1 (emisión, numeración, params).
- `comprobantes` — dominio de facturación, persistencia, numeración, PDF + QR.
- `clientes` — ABM de receptores por emisor (rutas anidadas `/emisores/:emisorId/clientes`).

### `packages/shared` — TypeScript + Zod
Tipos y validaciones compartidas (payloads de emisión, enums de tipos de comprobante/IVA/doc)
para tener una sola fuente de verdad entre front y back.

## Datos (modelo inicial, Prisma)
`User`, `Emisor` (1 user → N emisores/CUIT), `Certificado` (por emisor, cifrado),
`PuntoVenta`, `Cliente`, `Comprobante` (con CAE, QR, estado ARCA), `ItemComprobante`.

## Roadmap

| Fase | Objetivo | Entregable verificable | Estado |
|------|----------|------------------------|--------|
| **0** | Scaffolding | Monorepo levanta: `pnpm install`, Postgres en Docker, api arranca. | ✅ Hecho |
| **1** | WSAA homologación | Backend obtiene y cachea un TA válido con cert de testing. | 🟡 Código listo, sin probar contra ARCA (falta cert homolog.) |
| **2** | Emitir Factura C | `FECAESolicitar` devuelve CAE en homologación. | 🟡 Flujo completo cableado y verificado local; falta CAE real |
| **3** | A/B + IVA + NC/ND | Comprobantes discriminando IVA y notas de crédito/débito. | ✅ A/B con IVA discriminado + NC/ND con `CbtesAsoc` |
| **4** | App end-to-end | Emitir desde el celular contra el backend y ver el CAE. | ✅ App Expo (`apps/mobile`): login → emisores → cert → clientes → emisión → CAE/PDF/QR |
| **5** | PDF + QR | Comprobante en PDF con QR válido de ARCA. | ✅ QR PNG (`qrcode`) + PDF (`pdfkit`) con QR embebido |
| **6** | Producción | Onboarding de certs reales y pasaje a endpoints de producción. | ⬜ Pendiente |

### Backend ya implementado (Fases 1–3 parcial)
`auth` (JWT + scrypt), `emisores`, `certs` (vault AES-256-GCM), `arca/wsaa`, `arca/wsfe`
(WSFEv1: CAE, numeración, IVA por alícuota), `comprobantes` (orquesta la emisión + QR +
persistencia auditada, con ownership por usuario). 11 tests unitarios en verde.

### Onboarding de certificados (implementado)
`certs` genera el par de claves + CSR en el backend y empareja luego el `.crt` de ARCA:
- `POST /emisores/:id/csr` → genera clave RSA 2048 + CSR con el subject que exige ARCA
  (`C=AR, O=<razón social>, CN=<alias>, serialNumber=CUIT <cuit>`), guarda la clave privada
  cifrada y devuelve el CSR en PEM. La clave privada nunca sale del backend.
- `PUT /emisores/:id/certificado` → empareja el `.crt` descargado de ARCA con la clave ya
  guardada, validando que la clave pública del cert coincida con la del par generado.
- `POST /emisores/:id/certificado` → flujo manual (subir clave+cert propios), como antes.

### Alta de emisores desde un API client (implementado)
El onboarding de certificados descrito arriba vivía sólo detrás de `JwtAuthGuard`, o sea la
superficie de la app mobile. Un consumidor de la API (respondi) no tenía forma de dar de alta a
un contribuyente. `V1IssuersController` expone el mismo ciclo bajo `ServiceAuthGuard`:
`POST /v1/issuers`, `GET /v1/issuers`, `GET /v1/issuers/:id`, `POST /v1/issuers/:id/csr` y
`PUT /v1/issuers/:id/certificate`.

**Propiedad del emisor:** `Issuer.userId` es obligatorio y apunta a `User`, pero un `ApiClient` no
es un usuario. En vez de hacer nullable esa relación y reescribir el aislamiento en todos los
queries, cada `ApiClient` tiene un **usuario de servicio** implícito
(`<apiClientId>@service.chirola.internal`) que se crea solo la primera vez y es dueño de los
emisores dados de alta por API. Ese usuario no puede loguearse: su `password` no tiene el formato
`scrypt$salt$hash` que exige `verifyPassword`, así que la comparación siempre falla. Como efecto
secundario, el `@@unique([userId, cuit, environment])` que ya existía pasa a garantizar un emisor
por CUIT y entorno para cada API client, sin agregar constraints nuevas.

El paso de ARCA sigue siendo manual e inevitable: el CSR se genera acá, pero alguien tiene que
llevarlo al sitio de ARCA y volver con el `.crt` firmado. Ninguna API puede saltear ese trámite.

### Lo próximo para avanzar
1. **Cerrar Fase 1/2 de verdad:** con el onboarding ya listo, falta la parte externa del
   usuario: subir el CSR a ARCA, descargar el `.crt`, asociar `wsfe` en "Administrador de
   Relaciones" y registrar el punto de venta. Recién ahí se prueba `POST /comprobantes` end-to-end.
2. **Probar la app en un dispositivo/emulador** apuntando `EXPO_PUBLIC_API_URL` al backend de
   la LAN, y pulir UX (loading/errores, selección de cliente al facturar).

### App mobile (Fase 4, implementada)
Expo (SDK 57) + expo-router en `apps/mobile` (`@chirola/mobile`). Navegación por grupos
`(auth)` / `(app)` con guard de sesión en el layout raíz. Estado de datos con React Query;
tokens en `expo-secure-store`; cliente API (`lib/api.ts`) con `Authorization: Bearer` y
**rotación automática del refresh token** en 401. Reutiliza los schemas de `@chirola/shared`.
Pantallas: login/registro → lista/alta de emisores → detalle → onboarding de certificado
(genera CSR, lo copia, empareja el `.crt`) → ABM de clientes → emisión de comprobante
(ítems + IVA + receptor) → detalle con CAE, QR (PNG del backend) y descarga/compartir del PDF
(`expo-file-system` + `expo-sharing`). Base URL configurable con `EXPO_PUBLIC_API_URL`
(default `http://localhost:3000/api`). Verificado: `tsc --noEmit`, `eslint` y bundle de Metro
(`expo export`, 1664 módulos) en verde. Falta correrla en un device real contra el backend.

### Auth: refresh tokens + logout (implementado)
- Access token JWT de corta duración (`JWT_ACCESS_TTL`, default `1h`).
- Refresh token opaco (base64url) guardado **hasheado** (sha256) en `RefreshToken`,
  con vencimiento (`REFRESH_TOKEN_TTL_DAYS`, default 30 días).
- `POST /auth/refresh` rota el token: revoca el usado y emite un par nuevo (reuso → 401).
- `POST /auth/logout` revoca el refresh token (idempotente).
- `register`/`login` ahora devuelven `{ token, refreshToken, user }`.

### Módulo `clientes` (implementado)
ABM de receptores por emisor, con rutas anidadas y ownership vía `EmisoresService`:
`POST/GET /emisores/:emisorId/clientes`, `GET/PATCH/DELETE /emisores/:emisorId/clientes/:id`.
Unique `(emisor, tipoDoc, numeroDoc)` → 409 en duplicados; validación de CUIT/CUIL (11 dígitos)
en `@chirola/shared`. Aislamiento entre usuarios verificado (otro user → 403).

### PDF + QR PNG (Fase 5, implementado)
- `comprobantes/qr-image.util.ts` — `renderQrPng` (lib `qrcode`) sobre la URL del QR;
  `receptorDesdeQr` decodifica el receptor del payload canónico de AFIP.
- `comprobantes/pdf.util.ts` — `renderComprobantePdf` (lib `pdfkit`): A4 con letra A/B/C,
  emisor, receptor, tabla de ítems (formato es-AR), totales, comprobantes asociados, CAE +
  vencimiento y el QR embebido.
- Endpoints: `GET /comprobantes/:id/qr.png` (image/png) y `GET /comprobantes/:id/pdf`
  (application/pdf). El Content-Type se fija recién con el buffer listo para que los errores
  sigan devolviendo JSON.

### Notas de crédito/débito (Fase 3, implementado)
Las NC/ND (tipos 2/3/7/8/12/13) aceptan `comprobantesAsociados` en el payload de emisión y
se serializan como `<ar:CbtesAsoc>` en WSFEv1 (después de `CondicionIVAReceptorId`, antes de
`Iva`, según el orden del XSD). El schema exige al menos un asociado para NC/ND (400 si falta).
Cada `CbteAsoc` lleva `Tipo/PtoVta/Nro` y, opcionalmente, `Cuit` y `CbteFch`. Los asociados se
persisten en `Comprobante.comprobantesAsoc` (JSON) para auditoría.

## Decisiones tomadas
- Mobile: **Expo/React Native**.
- Backend: **Node.js + TypeScript (NestJS)**.
- ARCA auth: **self-host WSAA** (control total, sin terceros).
- MVP: **facturación completa** (A/B/C + notas de crédito/débito).

Ver detalle de la integración fiscal en [`arca-integracion.md`](arca-integracion.md).
