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

| Fase | Objetivo | Entregable verificable |
|------|----------|------------------------|
| **0** | Scaffolding | Monorepo levanta: `pnpm install`, Postgres en Docker, api y mobile arrancan. |
| **1** | WSAA homologación | Backend obtiene y cachea un TA válido con cert de testing. |
| **2** | Emitir Factura C | `FECAESolicitar` devuelve CAE en homologación. |
| **3** | A/B + IVA + NC/ND | Comprobantes discriminando IVA y notas de crédito/débito. |
| **4** | App end-to-end | Emitir desde el celular contra el backend y ver el CAE. |
| **5** | PDF + QR | Comprobante en PDF con QR válido de ARCA. |
| **6** | Producción | Onboarding de certs reales y pasaje a endpoints de producción. |

## Decisiones tomadas
- Mobile: **Expo/React Native**.
- Backend: **Node.js + TypeScript (NestJS)**.
- ARCA auth: **self-host WSAA** (control total, sin terceros).
- MVP: **facturación completa** (A/B/C + notas de crédito/débito).

Ver detalle de la integración fiscal en [`arca-integracion.md`](arca-integracion.md).
