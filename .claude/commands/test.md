# Test — Correr tests del proyecto

Ejecuta los tests del monorepo según lo que se necesite.

## API (NestJS + Jest)

```bash
pnpm --filter @chirola/api test
```

Un archivo específico (patrón sobre el path):
```bash
pnpm --filter @chirola/api test wsfe.service
```

Un test por nombre:
```bash
pnpm --filter @chirola/api test -t "obtiene CAE"
```

Watch mode durante desarrollo:
```bash
pnpm --filter @chirola/api test --watch
```

## Todos los paquetes

```bash
pnpm -r test
```

## Convenciones

- Tests Jest en `services/api`, nombre `*.spec.ts` al lado del archivo bajo test.
- Los servicios que hablan con ARCA (WSAA/WSFEv1) se testean con SOAP mockeado — no pegarle a
  homologación en unit tests.
- Todo test de datos de un contribuyente debe ejercitar el scope de `emisorId`.
- Los cálculos fiscales (totales, IVA, CbtesAsoc en notas de crédito/débito) deben tener
  cobertura: son la lógica de negocio crítica.

## Flujo

1. Corré los tests correspondientes.
2. Reportá: cuántos pasaron, cuántos fallaron, tiempo total.
3. Si hay fallos, mostrá el stack trace y analizá la causa raíz.
4. Ofrecé fixear si el error es claro.
