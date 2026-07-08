import type { Capability, Check, CheckResult, Project } from "../core/model.js";
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
};

export type { Capability, Check, CheckResult, Project };
