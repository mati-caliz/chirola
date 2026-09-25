import { defineConfig } from "eslint/config";
import globals from "globals";
import { standardConfig } from "./eslint.standard.mjs";

export default defineConfig([
  ...standardConfig({
    tsconfigRootDir: import.meta.dirname,
    ignores: ["prisma/migrations/**"],
    allowDefaultProject: ["jest.config.ts"],
  }),
  { languageOptions: { globals: { ...globals.node } } },
  { files: ["**/*.spec.ts"], languageOptions: { globals: { ...globals.jest } } },
  {
    // Falso positivo de Nest: un módulo es una clase vacía que sólo existe para llevar @Module().
    files: ["src/**/*.module.ts"],
    rules: { "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }] },
  },
  {
    // Los `http://` de estos servicios son los namespaces XML que exige ARCA en el envelope y
    // en el SOAPAction: son identificadores, no direcciones a las que se conecte.
    files: [
      "src/arca/wsfe/wsfe.service.ts",
      "src/arca/wsfex/wsfex.service.ts",
      "src/arca/padron/padron.service.ts",
    ],
    rules: { "sonarjs/no-clear-text-protocols": "off" },
  },
  {
    // Son herramientas de línea de comandos: lo que imprimen es su salida, no un log olvidado.
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
]);
