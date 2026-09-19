import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los guards se declaran por controller (`@UseGuards`), no hay uno global: la app usa
 * `JwtAuthGuard` y la API v1 que consume respondi usa `ServiceAuthGuard`, así que un guard
 * global de JWT dejaría a v1 pidiendo dos credenciales. El precio de esa flexibilidad es
 * que un controller nuevo nace abierto si alguien se olvida del decorador, y este archivo
 * es multi-tenant: una ruta sin guard expone comprobantes de todos los emisores.
 *
 * Este test es lo que hace que no se pueda olvidar.
 */

const SOURCE_DIR = join(__dirname, '..');

/** Sin autenticación a propósito: el login no puede pedir un token, y el health lo sondea Docker. */
const PUBLIC_CONTROLLERS = new Set(['auth/auth.controller.ts', 'health/health.controller.ts']);

function findControllers(directory: string, prefix = ''): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = join(directory, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(absolute).isDirectory()) return findControllers(absolute, relative);
    return relative.endsWith('.controller.ts') ? [relative] : [];
  });
}

describe('controller guards', () => {
  const controllers = findControllers(SOURCE_DIR);

  it('finds the controllers', () => {
    expect(controllers.length).toBeGreaterThan(10);
  });

  it('every controller declares a guard or is listed as public', () => {
    const unguarded = controllers.filter((relative) => {
      if (PUBLIC_CONTROLLERS.has(relative)) return false;
      return !readFileSync(join(SOURCE_DIR, relative), 'utf8').includes('@UseGuards');
    });

    expect(unguarded).toEqual([]);
  });

  it('the public list has no leftovers', () => {
    const missing = [...PUBLIC_CONTROLLERS].filter((relative) => !controllers.includes(relative));

    expect(missing).toEqual([]);
  });
});
