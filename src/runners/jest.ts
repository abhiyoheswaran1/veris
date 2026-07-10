import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { localBin, type RunContext, type Runner, runViaExec } from "./base.js";

export const jestRunner: Runner = {
  id: "jest",
  toCheck(
    project: Project,
    _cap: Capability,
    opts?: { targetFiles?: string[] },
  ): Check {
    return {
      id: "unit",
      title: "Unit tests",
      runner: "jest",
      cmd: localBin(project.root, "jest"),
      args: ["--ci", ...(opts?.targetFiles ?? [])],
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
