import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { biomeRunner } from "./biome.js";
import { eslintRunner } from "./eslint.js";
import { jestRunner } from "./jest.js";
import { nodeTestRunner } from "./node-test.js";
import { tscRunner } from "./tsc.js";
import { vitestRunner } from "./vitest.js";

export interface RunContext {
  root: string;
  runDir: string;
}

export interface Runner {
  id: string;
  toCheck(project: Project, cap: Capability): Check;
  run(check: Check, ctx: RunContext): Promise<CheckResult>;
}

export const runners: Record<string, Runner> = {
  tsc: tscRunner,
  vitest: vitestRunner,
  jest: jestRunner,
  "node-test": nodeTestRunner,
  eslint: eslintRunner,
  biome: biomeRunner,
};

export type { Capability, Check, CheckResult, Project };
