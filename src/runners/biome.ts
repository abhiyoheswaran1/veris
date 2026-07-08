import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { localBin, type RunContext, type Runner, runViaExec } from "./index.js";

export const biomeRunner: Runner = {
  id: "biome",
  toCheck(project: Project, _cap: Capability): Check {
    return {
      id: "lint",
      title: "Lint",
      runner: "biome",
      cmd: localBin(project.root, "biome"),
      args: ["check", "."],
    };
  },
  run(check: Check, ctx: RunContext): Promise<CheckResult> {
    return runViaExec(check, ctx, {
      pass: "no lint errors",
      fail: "lint errors found",
      timeoutMs: 3 * 60_000,
    });
  },
};
