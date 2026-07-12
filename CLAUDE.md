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

Multi-emisor: cada dato pertenece a un `emisorId`. **Todo query de datos de un contribuyente
debe estar filtrado por `emisorId`**, tomado del contexto autenticado, nunca de un parámetro
que mande el cliente.

```ts
// MAL — sin scope de emisor
this.prisma.cliente.findUnique({ where: { id } })

// BIEN
this.prisma.cliente.findFirst({ where: { id, emisorId } })
```

## Reglas de desarrollo (tolerancia cero)

- **No escribas comentarios en el código.** Ni siquiera para un "por qué" no obvio: el usuario
  prefiere código 100% autoexplicativo. Los nombres de variables/funciones deben bastar.
- **Cero `any` y cero supresión de linters.** Prohibido `@ts-ignore`, `eslint-disable` (ni de
  línea ni de bloque), casteos inseguros (`as unknown as X`). Resolvé la causa real (tipar bien,
  eliminar código muerto, ajustar la lógica) en vez de silenciar la regla.
- **Sin `var`.** `const` por default, `let` sólo cuando se reasigna.
- **Nombres completos y semánticos.** `comprobante` no `cbte`, `emisor` no `e`, `cliente` no `c`.
  Sólo `i`/`j` en loops triviales.
- **Sin magic numbers/strings.** Extraé constantes con nombre o usá los enums/schemas de
  `packages/shared`. Los códigos fiscales de ARCA (tipos de comprobante, conceptos, alícuotas)
  van como constantes nombradas, nunca literales sueltos.
- **Lógica en el backend.** El mobile no calcula totales, IVA, ni valida integridad fiscal.
- **Seguridad fiscal.** Las claves privadas se guardan cifradas y nunca se exponen a la app. No
  se commitea ningún `.key`, `.crt`, `.p12` ni `.env`.

## Convenciones

- **Git**: commits descriptivos en español, directo a `main` (sin PRs ni ramas de feature).
- **Backend (NestJS)**: patrón `controller → service`. Controllers delgados: sólo mapean HTTP →
  servicio (extraen `emisorId` del usuario autenticado y delegan), sin lógica ni defaulteo.
  Validación de inputs con schemas Zod de `@chirola/shared`. Acceso a datos vía Prisma, siempre
  con scope de `emisorId`. Tests con Jest (`*.spec.ts`).
- **Mobile (Expo)**: componentes `PascalCase`, hooks `camelCase`, funciones flecha. Data fetching
  con `@tanstack/react-query`. Componentes grandes se parten en subcomponentes/hooks.
- **Shared**: los tipos y schemas de dominio se definen una sola vez en `packages/shared` y se
  importan como `@chirola/shared` en front y back. No dupliques tipos entre paquetes.
- **Documentación .md**: no dupliques contenido derivable del código o `package.json` (instrucciones
  genéricas de instalación, listados de comandos, boilerplate). Conservá sólo contexto de negocio
  no derivable (protocolo ARCA/AFIP en `docs/arca-integracion.md`, decisiones de arquitectura en
  `docs/arquitectura.md`).

## Comandos

```bash
pnpm db:up          # PostgreSQL en Docker
pnpm api:dev        # backend NestJS en watch
pnpm mobile:dev     # Expo dev server
pnpm -r lint        # lint de todos los paquetes
pnpm -r test        # tests de todos los paquetes
```
