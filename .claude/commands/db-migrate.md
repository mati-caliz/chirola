# DB Migrate — Nueva migración Prisma

Crea y aplica una migración de schema con Prisma. Chirola usa Prisma Migrate contra PostgreSQL;
las migraciones viven en `services/api/prisma/migrations/`.

## Proceso

### 1. Asegurar la base corriendo

```bash
pnpm db:up
```

### 2. Editar el schema

Modificá `services/api/prisma/schema.prisma` con el cambio (nuevo modelo, campo, índice o
relación). Consideraciones del proyecto:

- **Aislamiento por emisor**: todo modelo con datos de un contribuyente lleva
  `emisorId String` + relación al `Emisor` e idealmente índice por `emisorId`. Sin esto se rompe
  el scope multi-emisor.
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`.
- IDs: seguí la convención existente en el schema (no mezcles estrategias de ID).
- Datos fiscales sensibles (claves, certificados): se guardan cifrados, nunca en claro.

### 3. Generar y aplicar la migración

```bash
pnpm --filter @chirola/api prisma:migrate
```

`prisma migrate dev` pide un nombre descriptivo en snake_case (ej: `add_index_clientes_emisor`),
crea el SQL en `prisma/migrations/`, lo aplica a la base local y regenera el Prisma Client.

### 4. Verificar

- El Prisma Client tipado refleja el cambio (`prisma:generate` corre solo dentro de `migrate dev`).
- Corré `cd services/api && npx tsc --noEmit` para confirmar que el código sigue compilando.
- Si hay servicios afectados, actualizalos manteniendo el scope de `emisorId`.

## Cuándo usarlo

- Al agregar modelos, campos, índices o relaciones.
- Ante cualquier cambio de schema que necesite persistirse.

## Notas

- **No edites SQL de migraciones ya aplicadas**: creá una migración nueva.
- Para inspeccionar la base: `pnpm --filter @chirola/api prisma:studio`.
