import { join } from "node:path";
import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { exec } from "../util/exec.js";
import type { RunContext, Runner } from "./index.js";

export const tscRunner: Runner = {
  id: "tsc",
  toCheck(project: Project, _cap: Capability): Check {
    return {
      id: "types",
      title: "Types",
      runner: "tsc",
      cmd: join(project.root, "node_modules", ".bin", "tsc"),
      args: ["--noEmit", "--pretty", "false"],
    };
  },
  async run(check: Check, ctx: RunContext): Promise<CheckResult> {
    const r = await exec(check.cmd, check.args, {
      cwd: ctx.root,
      timeoutMs: 5 * 60_000,
    });
    return {
      checkId: "types",
      status: r.code === 0 ? "passed" : r.timedOut ? "unknown" : "failed",
      durationMs: r.durationMs,
      summary: r.code === 0 ? "no type errors" : "type errors found",
    };
  },
};
