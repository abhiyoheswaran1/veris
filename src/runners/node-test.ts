import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import type { RunContext, Runner } from "./index.js";
import { runViaExec } from "./index.js";

export const nodeTestRunner: Runner = {
  id: "node-test",
  toCheck(_project: Project, _cap: Capability): Check {
    return {
      id: "unit",
      title: "Unit tests",
      runner: "node-test",
      cmd: process.execPath,
      args: ["--test"],
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
