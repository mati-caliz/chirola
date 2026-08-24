# Chirola

App mobile (iOS + Android) para operar **ARCA** (ex AFIP) de forma simple. MVP: facturación
electrónica (comprobantes A/B/C y notas de crédito/débito) con obtención de **CAE**.

## Arquitectura

Monorepo pnpm con separación estricta: **toda la lógica fiscal vive en el backend**. La app
**nunca** habla directo con ARCA ni ve las claves privadas.

```
App Expo (RN, iOS+Android)  ──HTTPS/JSON──►  Backend NestJS  ──SOAP──►  ARCA (WSAA + WSFEv1)
```

- **`apps/mobile`** — Expo Router + React Native + TypeScript. Capa de presentación "tonta".
- **`services/api`** — NestJS + Prisma + PostgreSQL. Custodia el vault de certificados, autentica
  contra ARCA (WSAA) y emite comprobantes (WSFEv1). Toda validación fiscal y cálculo vive acá.
- **`packages/shared`** — tipos y schemas Zod compartidos entre front y back.

Detalle en `docs/arquitectura.md` y `docs/arca-integracion.md`.

## Aislamiento por emisor (crítico)

Multi-emisor: cada dato pertenece a un `issuerId`. **Todo query de datos de un contribuyente
debe estar filtrado por `issuerId`**, tomado del contexto autenticado, nunca de un parámetro
que mande el cliente.

```ts
// MAL — sin scope de emisor
this.prisma.client.findUnique({ where: { id } })

// BIEN
this.prisma.client.findFirst({ where: { id, issuerId } })
```

## Reglas de desarrollo

Rigen las reglas globales de estilo. Lo propio de este repo:

- **Siglas del dominio fiscal argentino** (`cuit`, `cae`, `arca`) se mantienen tal
  cual como identificadores: no tienen traducción natural.
- **Los códigos fiscales de ARCA** (tipos de comprobante, conceptos, alícuotas) van
  como constantes nombradas o enums de `packages/shared`, nunca literales sueltos.
- **Lógica en el backend.** El mobile no calcula totales, IVA, ni valida integridad
  fiscal.
- **Seguridad fiscal.** Las claves privadas se guardan cifradas y nunca se exponen a
  la app. No se commitea ningún `.key`, `.crt`, `.p12` ni `.env`.

## Convenciones

- **Backend (NestJS)**: patrón `controller → service`. Controllers delgados: sólo mapean HTTP →
  servicio (extraen `issuerId` del usuario autenticado y delegan), sin lógica ni defaulteo.
  Validación de inputs con schemas Zod de `@chirola/shared`. Acceso a datos vía Prisma, siempre
  con scope de `issuerId`. Tests con Jest (`*.spec.ts`).
- **Mobile (Expo)**: componentes `PascalCase`, hooks `camelCase`, funciones flecha. Data fetching
  con `@tanstack/react-query`. Componentes grandes se parten en subcomponentes/hooks.
- **Shared**: los tipos y schemas de dominio se definen una sola vez en `packages/shared` y se
  importan como `@chirola/shared` en front y back. No dupliques tipos entre paquetes.
- **Documentación .md**: el contexto de negocio no derivable del código vive en
  `docs/arca-integracion.md` (protocolo ARCA/AFIP) y `docs/arquitectura.md` (decisiones
  de arquitectura).

## Comandos

```bash
pnpm db:up          # PostgreSQL en Docker
pnpm api:dev        # backend NestJS en watch
pnpm mobile:dev     # Expo dev server
pnpm -r lint        # lint de todos los paquetes
pnpm -r test        # tests de todos los paquetes
```
