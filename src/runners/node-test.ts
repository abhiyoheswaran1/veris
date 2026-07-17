import {
  type Capability,
  type Check,
  type CheckResult,
  checkKey,
  type Project,
} from "../core/model.js";
import type { RunContext, Runner } from "./base.js";
import { runViaExec } from "./base.js";

export const nodeTestRunner: Runner = {
  id: "node-test",
  toCheck(_project: Project, cap: Capability): Check {
    return {
      id: "unit",
      language: cap.language,
      key: checkKey("unit", cap.language),
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
