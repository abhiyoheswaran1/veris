import { join } from "node:path";
import type { Capability, Check, CheckResult, Project } from "../core/model.js";
import { writeLog } from "../evidence/store.js";
import { exec } from "../util/exec.js";

export interface RunContext {
  root: string;
  runDir: string;
}

export interface Runner {
  id: string;
  toCheck(project: Project, cap: Capability): Check;
  run(check: Check, ctx: RunContext): Promise<CheckResult>;
}

export function localBin(root: string, name: string): string {
  return join(root, "node_modules", ".bin", name);
}

const TAIL_LINES = 20;

export async function runViaExec(
  check: Check,
  ctx: RunContext,
  opts: { pass: string; fail: string; timeoutMs: number },
): Promise<CheckResult> {
  const r = await exec(check.cmd, check.args, {
    cwd: ctx.root,
    timeoutMs: opts.timeoutMs,
  });
  const status: CheckResult["status"] =
    r.code === 0 ? "passed" : r.timedOut ? "unknown" : "failed";
  const output = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
  const logRef = await writeLog(ctx.runDir, check.id, `${output}\n`);
  const result: CheckResult = {
    checkId: check.id,
    status,
    durationMs: r.durationMs,
    summary:
      status === "passed" ? opts.pass : r.timedOut ? "timed out" : opts.fail,
    logRef,
  };
  if (status !== "passed" && output) {
    result.outputTail = output.split("\n").slice(-TAIL_LINES).join("\n");
  }
  return result;
}
