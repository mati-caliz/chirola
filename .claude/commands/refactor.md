# Refactor — Análisis y mejora de un módulo

Módulo a refactorizar: **$ARGUMENTS**

## Paso 0 — Detectar alcance

Determiná si el módulo es **backend** (`services/api`), **mobile** (`apps/mobile`),
**shared** (`packages/shared`) o **varios** según el argumento:

- "api", "backend", "service", "controller", "arca", "wsaa", "wsfe" → **backend**
- "mobile", "app", "pantalla", "screen", "componente", "hook" → **mobile**
- "tipos", "schema", "zod", "shared" → **shared**
- Un dominio de negocio (ej: "clientes", "comprobantes", "emisores") → **backend + mobile + shared**

## Paso 1 — Identificar archivos

Listá los archivos del módulo antes de seguir:

- **Backend**: controllers, services, `*.util.ts`, módulos en `services/api/src/<modulo>/`.
- **Mobile**: pantallas, componentes, hooks, `lib/` en `apps/mobile/src/`.
- **Shared**: tipos y schemas en `packages/shared/src/`.

## Paso 2 — Analizar

Leé los archivos y buscá las categorías que apliquen.

### Backend (NestJS)

- **Controllers con lógica**: deben sólo mapear HTTP → servicio (extraer `emisorId` del usuario y
  delegar). Sin cálculos, defaulteo ni validaciones de negocio.
- **Aislamiento por emisor**: queries Prisma sin filtro por `emisorId`, o que confían en un
  `emisorId` que viene del cliente en vez del contexto autenticado.
- **Lógica fiscal duplicada**: cálculo de totales/IVA, armado de payloads ARCA o parsing SOAP
  repetido entre servicios; extraer a un helper.
- **Manejo de errores ARCA**: strings hardcodeados en vez de mapear los códigos de error de
  WSFEv1/WSAA; `catch` genéricos que se tragan el detalle fiscal.
- **Validación**: inputs sin schema Zod de `@chirola/shared`; parseo manual en vez del schema.

### Mobile (Expo)

- **Lógica que debería estar en el backend**: cálculos de totales, IVA, validaciones de
  integridad fiscal.
- **Componentes/hooks sobredimensionados**: partir en subcomponentes o hooks.
- **Data fetching**: fetch manual donde debería usarse `@tanstack/react-query`.
- **Reutilización**: UI reinventada que ya existe compartida.

### Todos

- **Tipos duplicados**: interfaces/tipos definidos en front y back que deberían vivir una sola vez
  en `packages/shared`.
- **Constantes y valores mágicos**: códigos fiscales de ARCA como literales sueltos; extraer a
  constantes nombradas o enums de shared.
- **Type safety**: `any`, casteos inseguros, `@ts-ignore`, `eslint-disable` (fixear la causa).
- **Dead code**: exports/componentes/tipos sin referencias (verificar con grep antes de borrar).
- **Simplificación**: condicionales anidados aplanables con early returns; duplicación entre
  archivos del módulo.

## Paso 3 — Reportar hallazgos

Mostrá sólo las categorías con hallazgos:

```
## Refactor — [módulo]

### [Categoría]
- [descripción] — archivo:línea
```

Cerrá con un resumen: `X hallazgos en Y categorías. Los más impactantes: [top 3].`

## Paso 4 — Aplicar

Preguntá al usuario qué aplicar: **todos**, **por categoría**, o **uno por uno**. No apliques
nada sin confirmación.

## Paso 5 — Verificar

1. `cd services/api && npx tsc --noEmit` y/o `cd apps/mobile && npx tsc --noEmit`.
2. `pnpm -r lint`.
3. Si tocaste lógica fiscal, corré `pnpm --filter @chirola/api test`.
4. Fixeá los errores introducidos por el refactor. Reportá (sin bloquear) los pre-existentes.

## Reglas

- Seguí `CLAUDE.md`: sin comentarios, sin `any`, sin `var`, nombres completos, scope de `emisorId`.
- Si un cambio requiere una decisión de diseño, marcalo como **[decisión requerida]** y explicá
  las opciones en vez de asumir.
- No rompas tests: si un refactor cambia interfaces, actualizá los tests.
