import expoConfig from "eslint-config-expo/flat.js";
import { defineConfig } from "eslint/config";
import { standardConfig } from "./eslint.standard.mjs";

export default defineConfig([
  ...standardConfig({ tsconfigRootDir: import.meta.dirname, frameworks: [...expoConfig] }),
  {
    // Falso positivo del plugin import que trae el preset de Expo: la copia del estándar no se
    // edita y usa `tseslint.configs`/`tseslint.plugin`, la forma que documenta typescript-eslint.
    files: ["eslint.standard.mjs"],
    rules: { "import/no-named-as-default-member": "off" },
  },
]);
