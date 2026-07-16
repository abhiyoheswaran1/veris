import {
  type Capability,
  type Check,
  type CheckResult,
  checkKey,
  type Project,
} from "../core/model.js";
import { writeLog } from "../evidence/store.js";
import { exec } from "../util/exec.js";
import { localBin, type RunContext, type Runner } from "./base.js";

interface PwStats {
  expected?: number;
  unexpected?: number;
  flaky?: number;
  skipped?: number;
}

export function parsePlaywrightStats(stdout: string): PwStats | null {
  try {
    const json = JSON.parse(stdout) as { stats?: PwStats };
    return json.stats ?? null;
  } catch {
    return null;
  }
}

const TAIL_LINES = 20;

export const playwrightRunner: Runner = {
  id: "playwright",
  toCheck(project: Project, cap: Capability): Check {
    return {
      id: "browser",
      language: cap.language,
      key: checkKey("browser", cap.language),
      title: "Browser tests",
      runner: "playwright",
      cmd: localBin(project.root, "playwright"),
      args: ["test", "--reporter=json"],
    };
  },
  async run(check: Check, ctx: RunContext): Promise<CheckResult> {
    const r = await exec(check.cmd, check.args, {
      cwd: ctx.root,
      timeoutMs: 15 * 60_000,
    });
    const output = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
    const logRef = await writeLog(ctx.runDir, check.id, `${output}\n`);
    const stats = parsePlaywrightStats(r.stdout);
    let status: CheckResult["status"];
    if (r.timedOut) {
      status = "unknown";
    } else if (stats) {
      status =
        r.code === 0 && (stats.unexpected ?? 0) === 0 ? "passed" : "failed";
    } else {
      // Exit code alone cannot confirm a pass without parseable results.
      status = r.code === 0 ? "unknown" : "failed";
    }
    const result: CheckResult = {
      checkId: check.key,
      status,
      durationMs: r.durationMs,
      summary:
        status === "passed"
          ? "browser tests passed"
          : r.timedOut
            ? "timed out"
            : status === "unknown"
              ? "browser tests ran but the results could not be parsed"
              : "browser tests failed",
      logRef,
    };
    if (stats) {
      const passed = stats.expected ?? 0;
      const failed = stats.unexpected ?? 0;
      result.counts = {
        passed,
        failed,
        total: passed + failed + (stats.flaky ?? 0) + (stats.skipped ?? 0),
      };
    }
    if (status !== "passed" && output) {
      result.outputTail = output.split("\n").slice(-TAIL_LINES).join("\n");
    }
    return result;
  },
};
