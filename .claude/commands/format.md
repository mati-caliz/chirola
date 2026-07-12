# Format — Autofix de estilo

Aplica el autofix de ESLint en todos los paquetes. Chirola no usa Prettier: el formateo y las
reglas de estilo los maneja ESLint (`eslint --fix` en la API, `expo lint` en el mobile).

```bash
pnpm -r lint
```

`pnpm --filter @chirola/api lint` corre `eslint --fix`, así que aplica los autofixes disponibles.

## Flujo

1. Corré el lint con autofix.
2. Mostrá el resumen de archivos modificados con `git diff --stat`.
3. Si quedan errores que ESLint no puede autofixear, resolvé la causa real (tipar bien, eliminar
   código muerto). **Nunca** los silencies con `eslint-disable`.
4. Si no hubo cambios, informalo.

## Cuándo usarlo

- Antes de commitear.
- Después de refactors grandes.
