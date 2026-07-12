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
| **3** | A/B + IVA + NC/ND | Comprobantes discriminando IVA y notas de crédito/débito. | ✅ A/B con IVA discriminado + NC/ND con `CbtesAsoc` |
| **4** | App end-to-end | Emitir desde el celular contra el backend y ver el CAE. | ⬜ Pendiente (`apps/mobile` no existe aún) |
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

### Lo próximo para avanzar
1. **Cerrar Fase 1/2 de verdad:** con el onboarding ya listo, falta la parte externa del
   usuario: subir el CSR a ARCA, descargar el `.crt`, asociar `wsfe` en "Administrador de
   Relaciones" y registrar el punto de venta. Recién ahí se prueba `POST /comprobantes` end-to-end.
2. **App mobile (Fase 4):** scaffolding Expo + pantallas login → emisores → cert → emisión → CAE/QR.
3. **Faltantes transversales:** módulo `clientes`, onboarding guiado del cert, refresh token/logout.

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
