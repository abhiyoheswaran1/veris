import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { exec } from "../util/exec.js";
import type { RunContext, Runner } from "./index.js";

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
  async run(check: Check, ctx: RunContext): Promise<CheckResult> {
    const r = await exec(check.cmd, check.args, {
      cwd: ctx.root,
      timeoutMs: 10 * 60_000,
    });
    return {
      checkId: "unit",
      status: r.code === 0 ? "passed" : r.timedOut ? "unknown" : "failed",
      durationMs: r.durationMs,
      summary: r.code === 0 ? "unit tests passed" : "unit tests failed",
    };
  },
};
