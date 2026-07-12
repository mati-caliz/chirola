# Chirola

App mobile (iOS + Android) para operar **ARCA** (ex AFIP) de forma simple. MVP: **facturación
electrónica** (comprobantes A/B/C y notas de crédito/débito) con obtención de **CAE**.

## Arquitectura

La app **nunca** habla directo con ARCA. Un backend intermedio custodia los certificados,
autentica contra ARCA y expone una API REST/JSON simple.

```
App Expo (RN, iOS+Android)  ──HTTPS/JSON──►  Backend NestJS  ──SOAP──►  ARCA (WSAA + WSFEv1)
```

- **`apps/mobile`** — Expo + React Native + TypeScript.
- **`services/api`** — NestJS + Prisma + PostgreSQL. Contiene el vault de certificados y los
  clientes SOAP de WSAA/WSFEv1.
- **`packages/shared`** — tipos y schemas Zod compartidos entre front y back.

Detalle en [`docs/arquitectura.md`](docs/arquitectura.md) y
[`docs/arca-integracion.md`](docs/arca-integracion.md).

## Requisitos

- Node >= 20 (probado en 24), pnpm 10, Docker, OpenSSL 3.
- Para probar contra ARCA: certificado de **homologación** y CUIT de testing.

## Desarrollo

```bash
pnpm install
pnpm db:up          # levanta PostgreSQL en Docker
pnpm api:dev        # backend en modo watch
pnpm mobile:dev     # Expo dev server
```

## Estado

Ver el roadmap por fases en [`docs/arquitectura.md`](docs/arquitectura.md#roadmap).

**Backend** con el flujo fiscal completo cableado (auth JWT, vault de certificados,
WSAA + WSFEv1, emisión de comprobantes con CAE + QR y persistencia auditada), verificado
localmente. Falta probar la emisión real contra **homologación** (necesita un certificado
de testing de ARCA) y construir la **app mobile** (`apps/mobile`, aún no existe).

> ⚠️ **Seguridad fiscal:** las claves privadas de los contribuyentes se guardan cifradas y
> nunca se exponen a la app. No se commitea ningún `.key`, `.crt`, `.p12` ni `.env` (ver `.gitignore`).
