import {
  type Capability,
  type Check,
  type CheckResult,
  checkKey,
  type Project,
} from "../core/model.js";
import { resolveBin } from "../util/resolve-bin.js";
import { type RunContext, type Runner, runViaExec } from "./base.js";

export interface GoRunnerSpec {
  runner: string; // registry key, e.g. "go-test"
  capId: "unit" | "types" | "lint";
  tool: string; // binary name, e.g. "go"
  args: string[];
  title: string;
  pass: string;
  fail: string;
  timeoutMs: number;
}

export function makeGoRunner(spec: GoRunnerSpec): Runner {
  return {
    id: spec.runner,
    toCheck(project: Project, _cap: Capability): Check {
      return {
        id: spec.capId,
        language: "go",
        key: checkKey(spec.capId, "go"),
        title: spec.title,
        runner: spec.runner,
        cmd: resolveBin(project.root, "go", spec.tool),
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

export const goTestRunner = makeGoRunner({
  runner: "go-test",
  capId: "unit",
  tool: "go",
  args: ["test", "./..."],
  title: "Unit tests (Go)",
  pass: "go test passed",
  fail: "go test failed",
  timeoutMs: 10 * 60_000,
});

export const goBuildRunner = makeGoRunner({
  runner: "go-build",
  capId: "types",
  tool: "go",
  args: ["build", "./..."],
  title: "Compile (go build)",
  pass: "compiles",
  fail: "compile errors",
  timeoutMs: 5 * 60_000,
});

export const golangciLintRunner = makeGoRunner({
  runner: "golangci-lint",
  capId: "lint",
  tool: "golangci-lint",
  args: ["run"],
  title: "Lint (golangci-lint)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const goVetRunner = makeGoRunner({
  runner: "go-vet",
  capId: "lint",
  tool: "go",
  args: ["vet", "./..."],
  title: "Lint (go vet)",
  pass: "no vet issues",
  fail: "vet issues",
  timeoutMs: 5 * 60_000,
});
