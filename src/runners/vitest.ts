import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { localBin, type RunContext, type Runner, runViaExec } from "./index.js";

export const vitestRunner: Runner = {
  id: "vitest",
  toCheck(project: Project, _cap: Capability): Check {
    return {
      id: "unit",
      title: "Unit tests",
      runner: "vitest",
      cmd: localBin(project.root, "vitest"),
      args: ["run", "--reporter=json"],
    };
  },
  run(check: Check, ctx: RunContext): Promise<CheckResult> {
    return runViaExec(check, ctx, {
      pass: "unit tests passed",
      fail: "unit tests failed",
      timeoutMs: 10 * 60_000,
    });
  },
};
