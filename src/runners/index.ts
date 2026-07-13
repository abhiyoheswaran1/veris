import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import type { Runner } from "./base.js";
import { biomeRunner } from "./biome.js";
import { eslintRunner } from "./eslint.js";
import { jestRunner } from "./jest.js";
import { nodeTestRunner } from "./node-test.js";
import { playwrightRunner } from "./playwright.js";
import { tscRunner } from "./tsc.js";
import { vitestRunner } from "./vitest.js";

export const runners: Record<string, Runner> = {
  tsc: tscRunner,
  vitest: vitestRunner,
  jest: jestRunner,
  "node-test": nodeTestRunner,
  eslint: eslintRunner,
  biome: biomeRunner,
  playwright: playwrightRunner,
};

export type { RunContext, Runner } from "./base.js";
export { localBin, runViaExec } from "./base.js";
export type { Capability, Check, CheckResult, Project };
