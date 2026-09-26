import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: String.raw`.*\.spec\.ts$`,
  transform: { [String.raw`^.+\.ts$`]: "ts-jest" },
  moduleNameMapper: { "^@chirola/shared$": "<rootDir>/../../../packages/shared/src/index.ts" },
  testEnvironment: "node",
  collectCoverageFrom: ["**/*.ts", "!**/*.spec.ts"],
  coverageDirectory: "../coverage",
  coverageReporters: ["text", "json-summary"],
};

export default config;
