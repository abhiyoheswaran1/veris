import { join } from "node:path";
import {
  type Capability,
  type Check,
  type CheckResult,
  checkKey,
  type Language,
  type Project,
} from "../core/model.js";
import { writeLog } from "../evidence/store.js";
import { exec } from "../util/exec.js";
import { resolveBin } from "../util/resolve-bin.js";

export interface RunContext {
  root: string;
  runDir: string;
}

export interface Runner {
  id: string;
  toCheck(
    project: Project,
    cap: Capability,
    opts?: { targetFiles?: string[] },
  ): Check;
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
  const logRef = await writeLog(ctx.runDir, check.key, `${output}\n`);
  const result: CheckResult = {
    checkId: check.key,
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

export interface ExecRunnerSpec {
  runner: string;
  capId: "unit" | "types" | "lint";
  tool: string;
  args: string[];
  title: string;
  pass: string;
  fail: string;
  timeoutMs: number;
}

// Generic adapter for a language whose tool is spawned by name (resolved via
// resolveBin) and judged by exit code through runViaExec. Backs the Python and
// Go runner families.
export function makeExecRunner(
  language: Language,
  spec: ExecRunnerSpec,
): Runner {
  return {
    id: spec.runner,
    toCheck(project: Project, _cap: Capability): Check {
      return {
        id: spec.capId,
        language,
        key: checkKey(spec.capId, language),
        title: spec.title,
        runner: spec.runner,
        cmd: resolveBin(project.root, language, spec.tool),
        args: spec.args,
      };
    },
    run(check: Check, ctx: RunContext): Promise<CheckResult> {
      return runViaExec(check, ctx, {
        pass: spec.pass,
        fail: spec.fail,
        timeoutMs: spec.timeoutMs,
      });
    },
  };
}
