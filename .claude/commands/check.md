# Check — Validación completa de calidad

Corre todas las validaciones de calidad del monorepo **de a una por vez, en orden**. Fixeá cada
falla antes de continuar al siguiente check.

## Orden de ejecución

1. Lint — todos los paquetes
2. TypeScript — `services/api`
3. TypeScript — `packages/shared`
4. TypeScript — `apps/mobile`
5. Tests — `services/api` (Jest)

## Qué corre

### 1. Lint
```bash
pnpm -r lint
```

### 2. TypeScript — API
```bash
cd services/api && npx tsc --noEmit
```

### 3. TypeScript — Shared
```bash
cd packages/shared && npx tsc --noEmit
```

### 4. TypeScript — Mobile
```bash
cd apps/mobile && npx tsc --noEmit
```

### 5. Tests — API
```bash
pnpm --filter @chirola/api test
```

## Estrategia de ejecución

1. Corré el check #1.
2. Si falla: leé los archivos con errores, aplicá todos los fixes, re-corré ese check.
   **Máximo 3 intentos por check.**
3. Si pasa (o se agotaron los intentos): anotá el resultado ✓/✗ y avanzá al siguiente.
4. Al final, mostrá el resumen completo ✓/✗.

**Nunca avances al siguiente check sin haber resuelto (o agotado intentos en) el actual.**

## Reglas ESTRICTAS

- **Un check a la vez.** Nunca lances dos en paralelo.
- **NUNCA uses `sleep` para esperar.** Usá el timeout del Bash tool.
- **NUNCA uses `run_in_background` + polling.** Corré en foreground con timeout suficiente.
- **NUNCA repitas un check que ya pasó.**
- **Fixeá TODO antes de re-correr.** Todos los errores del check actual juntos, después re-corrés.

## Errores comunes y cómo fixearlos

- **`@typescript-eslint/no-explicit-any`**: tipar correctamente, nunca `@ts-ignore` ni `as any`.
- **`no-unused-vars`**: eliminar la variable/import muerto.
- **Type error en Prisma**: regenerar el cliente con `pnpm --filter @chirola/api prisma:generate`
  si tocaste el schema.
- **Import de `@chirola/shared` roto**: reconstruir shared con `pnpm --filter @chirola/shared build`.
- **Test fiscal fallando**: leé el stack, verificá los códigos ARCA y el scope de `emisorId`.
