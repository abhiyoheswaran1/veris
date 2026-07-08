import { join } from "node:path";
import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { exec } from "../util/exec.js";
import type { RunContext, Runner } from "./index.js";

export const eslintRunner: Runner = {
  id: "eslint",
  toCheck(project: Project, _cap: Capability): Check {
    return {
      id: "lint",
      title: "Lint",
      runner: "eslint",
      cmd: join(project.root, "node_modules", ".bin", "eslint"),
      args: ["."],
    };
  },
  async run(check: Check, ctx: RunContext): Promise<CheckResult> {
    const r = await exec(check.cmd, check.args, {
      cwd: ctx.root,
      timeoutMs: 3 * 60_000,
    });
    return {
      checkId: "lint",
      status: r.code === 0 ? "passed" : r.timedOut ? "unknown" : "failed",
      durationMs: r.durationMs,
      summary: r.code === 0 ? "no lint errors" : "lint errors found",
    };
  },
};
