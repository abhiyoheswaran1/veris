import {
  type Capability,
  type Check,
  type CheckResult,
  checkKey,
  type Project,
} from "../core/model.js";
import { localBin, type RunContext, type Runner, runViaExec } from "./base.js";

export const eslintRunner: Runner = {
  id: "eslint",
  toCheck(project: Project, cap: Capability): Check {
    return {
      id: "lint",
      language: cap.language,
      key: checkKey("lint", cap.language),
      title: "Lint",
      runner: "eslint",
      cmd: localBin(project.root, "eslint"),
      args: ["."],
    };
  },
  run(check: Check, ctx: RunContext): Promise<CheckResult> {
    return runViaExec(check, ctx, {
      pass: "no lint errors",
      fail: "lint errors found",
      timeoutMs: 3 * 60_000,
    });
  },
};
