import {
  type Capability,
  type Check,
  type CheckResult,
  checkKey,
  type Project,
} from "../core/model.js";
import { resolveBin } from "../util/resolve-bin.js";
import { type RunContext, type Runner, runViaExec } from "./base.js";

export interface PythonRunnerSpec {
  runner: string; // registry key, e.g. "pytest"
  capId: "unit" | "types" | "lint";
  tool: string; // binary name, e.g. "pytest"
  args: string[];
  title: string;
  pass: string;
  fail: string;
  timeoutMs: number;
}

export function makePythonRunner(spec: PythonRunnerSpec): Runner {
  return {
    id: spec.runner,
    toCheck(project: Project, _cap: Capability): Check {
      return {
        id: spec.capId,
        language: "python",
        key: checkKey(spec.capId, "python"),
        title: spec.title,
        runner: spec.runner,
        cmd: resolveBin(project.root, "python", spec.tool),
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

export const pytestRunner = makePythonRunner({
  runner: "pytest",
  capId: "unit",
  tool: "pytest",
  args: ["-q"],
  title: "Unit tests (Python)",
  pass: "pytest passed",
  fail: "pytest failed",
  timeoutMs: 10 * 60_000,
});

export const mypyRunner = makePythonRunner({
  runner: "mypy",
  capId: "types",
  tool: "mypy",
  args: ["."],
  title: "Type check (mypy)",
  pass: "no type errors",
  fail: "type errors",
  timeoutMs: 5 * 60_000,
});

export const pyrightRunner = makePythonRunner({
  runner: "pyright",
  capId: "types",
  tool: "pyright",
  args: [],
  title: "Type check (pyright)",
  pass: "no type errors",
  fail: "type errors",
  timeoutMs: 5 * 60_000,
});

export const ruffRunner = makePythonRunner({
  runner: "ruff",
  capId: "lint",
  tool: "ruff",
  args: ["check", "."],
  title: "Lint (ruff)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const flake8Runner = makePythonRunner({
  runner: "flake8",
  capId: "lint",
  tool: "flake8",
  args: ["."],
  title: "Lint (flake8)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const pylintRunner = makePythonRunner({
  runner: "pylint",
  capId: "lint",
  tool: "pylint",
  args: ["."],
  title: "Lint (pylint)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});
