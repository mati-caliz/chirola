import { defineConfig } from "eslint/config";
import globals from "globals";
import { standardConfig } from "./eslint.standard.mjs";

export default defineConfig([
  ...standardConfig({ tsconfigRootDir: import.meta.dirname }),
  { languageOptions: { globals: { ...globals.node } } },
]);
