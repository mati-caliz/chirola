import { GUARDS_METADATA, MODULE_METADATA } from "@nestjs/common/constants";
import { AppModule } from "../app.module";
import { HealthController } from "../health/health.controller";
import { AuthController } from "./auth.controller";

/**
 * Los guards se declaran por controller (`@UseGuards`), no hay uno global: la app usa
 * `JwtAuthGuard` y la API v1 que consume respondi usa `ServiceAuthGuard`, así que un guard
 * global de JWT dejaría a v1 pidiendo dos credenciales. El precio de esa flexibilidad es
 * que un controller nuevo nace abierto si alguien se olvida del decorador, y este archivo
 * es multi-tenant: una ruta sin guard expone comprobantes de todos los emisores.
 *
 * Este test es lo que hace que no se pueda olvidar.
 */

/** Sin autenticación a propósito: el login no puede pedir un token, y el health lo sondea Docker. */
const PUBLIC_CONTROLLERS: ReadonlySet<unknown> = new Set([AuthController, HealthController]);

const MINIMUM_EXPECTED_CONTROLLERS = 10;

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function metadataList(target: object, key: string): unknown[] {
  return asList(Reflect.getMetadata(key, target));
}

function propertyList(target: object, key: string): unknown[] {
  return asList(Reflect.get(target, key));
}

interface ModuleSource {
  imports: unknown[];
  controllers: unknown[];
}

function moduleSources(entry: unknown): ModuleSource[] {
  if (typeof entry === "function") {
    return [
      {
        imports: metadataList(entry, MODULE_METADATA.IMPORTS),
        controllers: metadataList(entry, MODULE_METADATA.CONTROLLERS),
      },
    ];
  }
  if (typeof entry !== "object" || entry === null) return [];
  const forwarded: unknown = Reflect.get(entry, "forwardRef");
  if (typeof forwarded === "function") {
    const resolved: unknown = Reflect.apply(forwarded, undefined, []);
    return moduleSources(resolved);
  }
  const dynamicModule: ModuleSource = {
    imports: propertyList(entry, MODULE_METADATA.IMPORTS),
    controllers: propertyList(entry, MODULE_METADATA.CONTROLLERS),
  };
  return [...moduleSources(Reflect.get(entry, "module")), dynamicModule];
}

function findControllers(rootModule: unknown): unknown[] {
  const visitedModules = new Set<unknown>();
  const controllers = new Set<unknown>();
  const pending: unknown[] = [rootModule];
  for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
    if (visitedModules.has(entry)) continue;
    visitedModules.add(entry);
    for (const source of moduleSources(entry)) {
      source.controllers.forEach((controller) => controllers.add(controller));
      pending.push(...source.imports);
    }
  }
  return [...controllers];
}

function hasGuards(target: object): boolean {
  const guards: unknown = Reflect.getMetadata(GUARDS_METADATA, target);
  return Array.isArray(guards) && guards.length > 0;
}

function controllerDeclaresGuards(controller: unknown): boolean {
  if (typeof controller !== "function") return false;
  if (hasGuards(controller)) return true;
  const prototype: unknown = Reflect.get(controller, "prototype");
  if (typeof prototype !== "object" || prototype === null) return false;
  return Object.getOwnPropertyNames(prototype).some((methodName) => {
    const method: unknown = Reflect.get(prototype, methodName);
    return typeof method === "function" && hasGuards(method);
  });
}

function controllerName(controller: unknown): string {
  return typeof controller === "function" ? controller.name : String(controller);
}

describe("controller guards", () => {
  const controllers = findControllers(AppModule);

  it("finds the controllers", () => {
    expect(controllers.length).toBeGreaterThan(MINIMUM_EXPECTED_CONTROLLERS);
  });

  it("every controller declares a guard or is listed as public", () => {
    const unguarded = controllers
      .filter((controller) => !PUBLIC_CONTROLLERS.has(controller))
      .filter((controller) => !controllerDeclaresGuards(controller))
      .map(controllerName);

    expect(unguarded).toEqual([]);
  });

  it("the public list has no leftovers", () => {
    const missing = [...PUBLIC_CONTROLLERS]
      .filter((controller) => !controllers.includes(controller))
      .map(controllerName);

    expect(missing).toEqual([]);
  });
});
