# Chirola

App mobile (iOS y Android) para operar **ARCA** (ex AFIP) de forma simple: facturación
electrónica con obtención de CAE, notas de crédito y débito, PDF con QR y consulta de padrón.

Es además el backend fiscal de otras apps propias: respondi y gastronova emiten a través de su
API v1 en vez de integrar WSAA y WSFEv1 cada una por su lado.

## Arquitectura

La app **nunca** habla directo con ARCA ni ve las claves privadas.

```
App Expo (RN, iOS+Android)  ──HTTPS/JSON──►  Backend NestJS  ──SOAP──►  ARCA (WSAA + WSFEv1)
```

- **`apps/mobile`** — Expo y React Native.
- **`services/api`** — NestJS con Prisma y PostgreSQL: el vault de certificados, los clientes
  SOAP y todo el cálculo fiscal.
- **`packages/shared`** — los tipos y schemas Zod que comparten front y back.

El detalle está en [`docs/arquitectura.md`](docs/arquitectura.md), el protocolo en
[`docs/arca-integracion.md`](docs/arca-integracion.md), qué cubre hoy en
[`docs/arca-ampliacion.md`](docs/arca-ampliacion.md) y lo que falta en
[`docs/roadmap.md`](docs/roadmap.md).

## Desarrollo

Necesita Node 20 o superior, pnpm 10, Docker y OpenSSL 3.

```bash
pnpm install
pnpm db:up          # PostgreSQL en Docker
pnpm api:dev        # backend en watch
pnpm mobile:dev     # Expo dev server
```

Dos trampas al clonar de cero: `pnpm install --ignore-scripts` deja `@chirola/shared` sin
compilar y `nest build` falla con "Cannot find module", así que hay que correr
`pnpm --filter @chirola/shared build` antes; y el build del backend necesita
`pnpm --filter @chirola/api prisma:generate` primero, o compila contra los tipos vacíos de
`@prisma/client` y tira errores que parecen del código.

Para probar contra ARCA hace falta un certificado de homologación y un CUIT de testing.

## Seguridad fiscal

Las claves privadas de los contribuyentes se guardan cifradas con AES-256-GCM y nunca se exponen
a la app. No se commitea ningún `.key`, `.crt`, `.p12` ni `.env`.

## Producción

Corre en el VPS con `docker-compose.prod.yml` (`chirola-api` y `chirola-db`), sin ruta pública:
lo consumen las otras apps por la red interna, en `http://chirola-api:3000/api`. El schema se
aplica con `prisma migrate deploy`, no se crea solo.
