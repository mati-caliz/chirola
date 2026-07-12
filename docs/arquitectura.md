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
- `auth` — usuarios de la app (registro/login, JWT).
- `emisores` — datos del contribuyente (CUIT, condición IVA, puntos de venta).
- `certs` — vault cifrado; generación de CSR; carga del `.crt`.
- `arca/wsaa` — LTR + firma CMS + cache del TA.
- `arca/wsfe` — cliente SOAP de WSFEv1 (emisión, numeración, params).
- `comprobantes` — dominio de facturación, persistencia, numeración, PDF + QR.
- `clientes` — receptores.

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
| **3** | A/B + IVA + NC/ND | Comprobantes discriminando IVA y notas de crédito/débito. | 🟡 A/B con IVA discriminado implementado; falta NC/ND (`CbtesAsoc`) |
| **4** | App end-to-end | Emitir desde el celular contra el backend y ver el CAE. | ⬜ Pendiente (`apps/mobile` no existe aún) |
| **5** | PDF + QR | Comprobante en PDF con QR válido de ARCA. | 🟡 URL del QR generada; falta render PNG + PDF |
| **6** | Producción | Onboarding de certs reales y pasaje a endpoints de producción. | ⬜ Pendiente |

### Backend ya implementado (Fases 1–3 parcial)
`auth` (JWT + scrypt), `emisores`, `certs` (vault AES-256-GCM), `arca/wsaa`, `arca/wsfe`
(WSFEv1: CAE, numeración, IVA por alícuota), `comprobantes` (orquesta la emisión + QR +
persistencia auditada, con ownership por usuario). 11 tests unitarios en verde.

### Lo próximo para avanzar
1. **Cerrar Fase 1/2 de verdad:** cargar un cert de **homologación** real y obtener un CAE.
   Requiere: generar clave+CSR (falta endpoint en `certs`), asociar `wsfe` en ARCA, registrar
   punto de venta. Recién ahí se prueba `POST /comprobantes` end-to-end.
2. **Notas de crédito/débito (Fase 3):** agregar `CbtesAsoc` al request de WSFEv1.
3. **App mobile (Fase 4):** scaffolding Expo + pantallas login → emisores → cert → emisión → CAE/QR.
4. **PDF + QR PNG (Fase 5):** render del QR (lib `qrcode`) y armado del PDF.
5. **Faltantes transversales:** módulo `clientes`, onboarding guiado del cert, refresh token/logout.

## Decisiones tomadas
- Mobile: **Expo/React Native**.
- Backend: **Node.js + TypeScript (NestJS)**.
- ARCA auth: **self-host WSAA** (control total, sin terceros).
- MVP: **facturación completa** (A/B/C + notas de crédito/débito).

Ver detalle de la integración fiscal en [`arca-integracion.md`](arca-integracion.md).
