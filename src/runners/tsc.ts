import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { localBin, type RunContext, type Runner, runViaExec } from "./base.js";

export const tscRunner: Runner = {
  id: "tsc",
  toCheck(project: Project, _cap: Capability): Check {
    return {
      id: "types",
      title: "Types",
      runner: "tsc",
      cmd: localBin(project.root, "tsc"),
      args: ["--noEmit", "--pretty", "false"],
    };
  },
  run(check: Check, ctx: RunContext): Promise<CheckResult> {
    return runViaExec(check, ctx, {
      pass: "no type errors",
      fail: "type errors found",
      timeoutMs: 5 * 60_000,
    });
  },
};
