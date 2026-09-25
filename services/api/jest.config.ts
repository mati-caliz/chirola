import type { Config } from "jest";

const MINIMUM_LINE_COVERAGE_PERCENT = 80;
const MINIMUM_BRANCH_COVERAGE_PERCENT = 70;

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: String.raw`.*\.spec\.ts$`,
  transform: { [String.raw`^.+\.ts$`]: "ts-jest" },
  moduleNameMapper: { "^@chirola/shared$": "<rootDir>/../../../packages/shared/src/index.ts" },
  testEnvironment: "node",
  collectCoverageFrom: ["**/*.ts", "!**/*.spec.ts"],
  coverageDirectory: "../coverage",
  coverageThreshold: {
    global: { lines: MINIMUM_LINE_COVERAGE_PERCENT, branches: MINIMUM_BRANCH_COVERAGE_PERCENT },
  },
};

export default config;
