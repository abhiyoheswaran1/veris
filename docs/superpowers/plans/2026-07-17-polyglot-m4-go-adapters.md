# Polyglot Verification — Milestone 4: Go Adapters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register runnable Go adapters — `go test ./...` (unit), `go build ./...` (types), `golangci-lint run` / `go vet ./...` (lint) — so a detected Go capability executes its real tool and folds into the merged verdict.

**Architecture:** M2 emits Go `Capability` objects whose `runner` names are `go-test`/`go-build`/`golangci-lint`/`go-vet`. This milestone adds a `makeGoRunner` factory (parallel to M3's `makePythonRunner`) that builds a `Check` (command resolved via `resolveBin(root, "go", tool)`) and runs it through `runViaExec`. Three of the four runners invoke the `go` binary with different subcommands (`test`/`build`/`vet`); `golangci-lint` is its own binary — so the factory separates the registry `runner` name from the `tool` binary and its `args`. No changes to detection, verdict, evidence, or reporters. JS behavior is untouched.

**Tech Stack:** TypeScript (strict, ESM, `.js` specifiers), Vitest, Biome. No new dependencies. Go tools are shelled out via the central `exec`; they need not be installed to build or test this milestone (tests exercise `toCheck` + registry wiring only).

## Global Constraints

- **No new runtime dependencies.**
- **ESM import specifiers end in `.js`.**
- **`veriskit`/`VerisKit` naming.**
- **Runner-name contract (must match what M2 detection emits exactly):** `go-test`, `go-build`, `golangci-lint`, `go-vet`.
- **Binary vs runner name:** `go-test`/`go-build`/`go-vet` all spawn the `go` binary (`tool: "go"`) with subcommand args; `golangci-lint` spawns the `golangci-lint` binary.
- **Spawn via `resolveBin(root, "go", tool)`.**
- **Tests are hermetic:** assert `toCheck` output (cmd/args/key/language) and registry membership; do NOT require Go installed and do NOT execute anything.
- **JS unchanged:** existing JS runner tests and `verify` output/exit codes stay identical.
- **Every task ends green:** `npm run verify` passes before each commit.
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure

- `src/runners/go.ts` — NEW: `makeGoRunner(spec)` factory + the four Go `Runner` instances.
- `src/runners/index.ts` — register the four Go runners.
- `src/runners/go.test.ts` — NEW: toCheck + registry tests.

---

## Task 1: Go runner factory + go-test (unit) + go-build (types)

**Files:**
- Create: `src/runners/go.ts`
- Modify: `src/runners/index.ts`
- Test: `src/runners/go.test.ts`

**Interfaces:**
- Consumes: `Capability`, `Check`, `CheckResult`, `Project`, `checkKey` from `../core/model.js`; `resolveBin` from `../util/resolve-bin.js`; `RunContext`, `Runner`, `runViaExec` from `./base.js`.
- Produces:
  - `makeGoRunner(spec): Runner` where `spec = { runner: string; capId: "unit"|"types"|"lint"; tool: string; args: string[]; title: string; pass: string; fail: string; timeoutMs: number }`.
  - `goTestRunner` (name `go-test`, capId `unit`, tool `go`, args `["test","./..."]`).
  - `goBuildRunner` (name `go-build`, capId `types`, tool `go`, args `["build","./..."]`).
  - `runners["go-test"]` and `runners["go-build"]` registered.

- [ ] **Step 1: Write the failing test**

Create `src/runners/go.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { goBuildRunner, goTestRunner } from "./go.js";
import { runners } from "./index.js";

const project = { root: "/tmp/goproj" } as Project;
const cap = (id: "unit" | "types" | "lint", runner: string): Capability => ({
  id,
  language: "go",
  available: true,
  runner,
});

describe("goTestRunner", () => {
  it("builds a unit:go check that runs `go test ./...`", () => {
    const check = goTestRunner.toCheck(project, cap("unit", "go-test"));
    expect(check.id).toBe("unit");
    expect(check.language).toBe("go");
    expect(check.key).toBe("unit:go");
    expect(check.runner).toBe("go-test");
    expect(check.cmd.endsWith("go")).toBe(true);
    expect(check.args).toEqual(["test", "./..."]);
  });

  it("is registered under go-test", () => {
    expect(runners["go-test"]).toBe(goTestRunner);
  });
});

describe("goBuildRunner", () => {
  it("builds a types:go check that runs `go build ./...`", () => {
    const check = goBuildRunner.toCheck(project, cap("types", "go-build"));
    expect(check.key).toBe("types:go");
    expect(check.cmd.endsWith("go")).toBe(true);
    expect(check.args).toEqual(["build", "./..."]);
  });

  it("is registered under go-build", () => {
    expect(runners["go-build"]).toBe(goBuildRunner);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/runners/go.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/runners/go.ts`**

```ts
import {
  type Capability,
  type Check,
  checkKey,
  type CheckResult,
  type Project,
} from "../core/model.js";
import { resolveBin } from "../util/resolve-bin.js";
import { type RunContext, type Runner, runViaExec } from "./base.js";

export interface GoRunnerSpec {
  runner: string; // registry key, e.g. "go-test"
  capId: "unit" | "types" | "lint";
  tool: string; // binary name, e.g. "go" or "golangci-lint"
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
```

- [ ] **Step 4: Register in `src/runners/index.ts`**

Add the import and the two map entries (leave existing entries untouched):

```ts
import { goBuildRunner, goTestRunner } from "./go.js";
```

```ts
  "go-test": goTestRunner,
  "go-build": goBuildRunner,
```

- [ ] **Step 5: Run tests, then full suite**

Run: `npx vitest run src/runners/go.test.ts && npm run verify`
Expected: PASS. If a runner-count assertion in `src/runners/lint.test.ts` exists, update the count to include the two new runners.

- [ ] **Step 6: Commit**

```bash
git add src/runners/go.ts src/runners/go.test.ts src/runners/index.ts src/runners/lint.test.ts
git commit -m "feat(runners): go adapter factory + go test (unit) + go build (types)"
```

---

## Task 2: golangci-lint + go-vet (lint) + integration + dogfood

**Files:**
- Modify: `src/runners/go.ts`
- Modify: `src/runners/index.ts`
- Test: `src/runners/go.test.ts` (extend)

**Interfaces:**
- Produces: `golangciLintRunner` (name `golangci-lint`, capId `lint`, tool `golangci-lint`, args `["run"]`), `goVetRunner` (name `go-vet`, capId `lint`, tool `go`, args `["vet","./..."]`); both registered.

- [ ] **Step 1: Write the failing test**

Add to `src/runners/go.test.ts`:

```ts
import { goVetRunner, golangciLintRunner } from "./go.js";

describe("go lint runners", () => {
  it("golangci-lint builds a lint:go check running `golangci-lint run`", () => {
    const check = golangciLintRunner.toCheck(project, cap("lint", "golangci-lint"));
    expect(check.key).toBe("lint:go");
    expect(check.cmd.endsWith("golangci-lint")).toBe(true);
    expect(check.args).toEqual(["run"]);
  });

  it("go-vet builds a lint:go check running `go vet ./...`", () => {
    const check = goVetRunner.toCheck(project, cap("lint", "go-vet"));
    expect(check.key).toBe("lint:go");
    expect(check.cmd.endsWith("go")).toBe(true);
    expect(check.args).toEqual(["vet", "./..."]);
  });

  it("every go runner name emitted by detection has a registered runner", () => {
    for (const name of ["go-test", "go-build", "golangci-lint", "go-vet"]) {
      expect(runners[name]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/runners/go.test.ts`
Expected: FAIL — lint runners not exported.

- [ ] **Step 3: Add the runners in `src/runners/go.ts`**

Append:

```ts
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
```

- [ ] **Step 4: Register in `src/runners/index.ts`**

```ts
import {
  goBuildRunner,
  goTestRunner,
  goVetRunner,
  golangciLintRunner,
} from "./go.js";
```

Add to the map:

```ts
  "go-test": goTestRunner,
  "go-build": goBuildRunner,
  "golangci-lint": golangciLintRunner,
  "go-vet": goVetRunner,
```

- [ ] **Step 5: Run tests, then full suite**

Run: `npx vitest run src/runners/go.test.ts && npm run verify`
Expected: PASS. Update the `src/runners/lint.test.ts` runner-count assertion to include the two new runners.

- [ ] **Step 6: Dogfood — confirm JS is untouched**

Run: `node bin/veris verify` in this repo (JS-only).
Expected: same `Checks` block, verdict, and exit code as before — registering Go runners must not affect a JS-only project.

- [ ] **Step 7: Commit**

```bash
git add src/runners/go.ts src/runners/index.ts src/runners/go.test.ts src/runners/lint.test.ts
git commit -m "feat(runners): go linters (golangci-lint, go vet) + registry integration"
```

---

## Self-Review

**Spec coverage (M4 — spec §6 Go adapters):**
- `go test ./...` (unit) → Task 1 ✓
- `go build ./...` (types) → Task 1 ✓
- `golangci-lint run` + `go vet ./...` (lint) → Task 2 ✓
- All registered under the exact names M2 detection emits → Tasks 1–2 registry entries + Task 2 integration test ✓
- Registry-name-vs-binary separation (`go-test`→`go` binary) handled by the factory's `runner`/`tool` split → Task 1 ✓
- Reuses `resolveBin` + `runViaExec` → factory ✓
- JS untouched → Task 2 Step 6 dogfood ✓

**Placeholder scan:** none; every step has complete code. ✓

**Type consistency:** `GoRunnerSpec`/`makeGoRunner` fixed in Task 1, reused in Task 2; runner names match the M2 vocabulary; `capId` union is a subset of `CapabilityId`. ✓

**Known-refine (non-blocking):** `golangci-lint run` and `go vet ./...` default args are idiomatic; a Go monorepo with build tags or a non-root module may need refinement (revisit on the M5 polyglot fixture). Same `binExists` existence-vs-executable / win32 caveats from M2 apply.

**Deferred:** verify/reporter language-aware display (M5), polyglot `affected` (later).
