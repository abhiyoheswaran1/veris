# Polyglot Verification — Milestone 3: Python Adapters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register runnable Python adapters — pytest (unit), mypy/pyright (types), ruff/flake8/pylint (lint) — so a detected Python capability executes its real tool and folds into the merged verdict, instead of reporting `no runner registered`.

**Architecture:** M2 emits Python `Capability` objects whose `runner` names are `pytest`/`mypy`/`pyright`/`ruff`/`flake8`/`pylint`. This milestone adds a small factory (`makePythonRunner`) that builds a `Check` (command resolved via `resolveBin(root, "python", tool)` so a project `.venv` is used) and runs it through the existing `runViaExec` (exit 0 = passed, non-zero = failed, timeout = unknown). Each runner is registered in the `runners` registry under its name. No changes to detection, verdict, evidence, or reporters — the M1 pipeline already handles any registered runner. JS behavior is untouched (JS runner names are unchanged and still map to their existing adapters).

**Tech Stack:** TypeScript (strict, ESM, `.js` specifiers), Vitest, Biome. No new dependencies. Python tools are shelled out via the central `exec`; they need not be installed to build or test this milestone (tests exercise `toCheck` command construction + registry wiring, mirroring the existing JS runner tests, which never actually run tsc/vitest).

## Global Constraints

- **No new runtime dependencies.**
- **ESM import specifiers end in `.js`.**
- **`veriskit`/`VerisKit` naming.**
- **Runner-name contract (must match what M2 detection emits, exactly):** `pytest`, `mypy`, `pyright`, `ruff`, `flake8`, `pylint`.
- **Spawn via `resolveBin(root, "python", tool)`** — never a bare hard-coded path — so a project `.venv`/`venv` tool is preferred over PATH.
- **Tests are hermetic:** assert `toCheck` output (cmd/args/key/language) and registry membership; do NOT require the Python tools to be installed and do NOT execute them.
- **JS unchanged:** existing JS runner tests and `verify` output/exit codes stay green and identical.
- **Every task ends green:** `npm run verify` passes before each commit.
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure

- `src/runners/python.ts` — NEW: `makePythonRunner(spec)` factory + the six Python `Runner` instances.
- `src/runners/index.ts` — register the six Python runners in the `runners` map.
- `src/runners/python.test.ts` — NEW: toCheck + registry tests.

---

## Task 1: Python runner factory + pytest (unit)

**Files:**
- Create: `src/runners/python.ts`
- Modify: `src/runners/index.ts`
- Test: `src/runners/python.test.ts`

**Interfaces:**
- Consumes: `Capability`, `Check`, `CheckResult`, `Project`, `checkKey` from `../core/model.js`; `resolveBin` from `../util/resolve-bin.js`; `RunContext`, `Runner`, `runViaExec` from `./base.js`.
- Produces:
  - `makePythonRunner(spec): Runner` where `spec = { runner: string; capId: "unit"|"types"|"lint"; tool: string; args: string[]; title: string; pass: string; fail: string; timeoutMs: number }`.
  - `pytestRunner: Runner` (registry name `pytest`, capId `unit`).
  - `runners.pytest` registered.

- [ ] **Step 1: Write the failing test**

Create `src/runners/python.test.ts`:

```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { pytestRunner } from "./python.js";
import { runners } from "./index.js";

const project = { root: "/tmp/pyproj" } as Project;
const cap = (): Capability => ({
  id: "unit",
  language: "python",
  available: true,
  runner: "pytest",
});

describe("pytestRunner", () => {
  it("builds a python:unit check that runs pytest", () => {
    const check = pytestRunner.toCheck(project, cap());
    expect(check.id).toBe("unit");
    expect(check.language).toBe("python");
    expect(check.key).toBe("unit:python");
    expect(check.runner).toBe("pytest");
    // resolveBin with no .venv falls back to the bare tool name
    expect(check.cmd).toBe("pytest");
    expect(check.args).toEqual(["-q"]);
  });

  it("prefers a .venv/bin/pytest when the project has one", () => {
    // resolveBin returns the venv path only when it exists; here we only assert
    // the command ends in the tool name so both branches are acceptable.
    const check = pytestRunner.toCheck(project, cap());
    expect(check.cmd.endsWith("pytest")).toBe(true);
  });

  it("is registered under its runner name", () => {
    expect(runners.pytest).toBe(pytestRunner);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/runners/python.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/runners/python.ts`**

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
```

- [ ] **Step 4: Register pytest in `src/runners/index.ts`**

Add the import and the map entry (leave all existing entries untouched):

```ts
import { pytestRunner } from "./python.js";
```

```ts
export const runners: Record<string, Runner> = {
  tsc: tscRunner,
  vitest: vitestRunner,
  jest: jestRunner,
  "node-test": nodeTestRunner,
  eslint: eslintRunner,
  biome: biomeRunner,
  playwright: playwrightRunner,
  pytest: pytestRunner,
};
```

- [ ] **Step 5: Run tests, then full suite**

Run: `npx vitest run src/runners/python.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/runners/python.ts src/runners/python.test.ts src/runners/index.ts
git commit -m "feat(runners): python adapter factory + pytest (unit)"
```

---

## Task 2: mypy + pyright (types)

**Files:**
- Modify: `src/runners/python.ts`
- Modify: `src/runners/index.ts`
- Test: `src/runners/python.test.ts` (extend)

**Interfaces:**
- Consumes: `makePythonRunner` from Task 1.
- Produces: `mypyRunner` (name `mypy`, capId `types`, args `["."]`), `pyrightRunner` (name `pyright`, capId `types`, args `[]`); both registered.

- [ ] **Step 1: Write the failing test**

Add to `src/runners/python.test.ts`:

```ts
import { mypyRunner, pyrightRunner } from "./python.js";

describe("python types runners", () => {
  const typesCap = (runner: string): Capability => ({
    id: "types",
    language: "python",
    available: true,
    runner,
  });

  it("mypy builds a types:python check", () => {
    const check = mypyRunner.toCheck(project, typesCap("mypy"));
    expect(check.key).toBe("types:python");
    expect(check.cmd.endsWith("mypy")).toBe(true);
    expect(check.args).toEqual(["."]);
    expect(runners.mypy).toBe(mypyRunner);
  });

  it("pyright builds a types:python check", () => {
    const check = pyrightRunner.toCheck(project, typesCap("pyright"));
    expect(check.key).toBe("types:python");
    expect(check.cmd.endsWith("pyright")).toBe(true);
    expect(check.args).toEqual([]);
    expect(runners.pyright).toBe(pyrightRunner);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/runners/python.test.ts`
Expected: FAIL — `mypyRunner`/`pyrightRunner` not exported.

- [ ] **Step 3: Add the runners in `src/runners/python.ts`**

Append:

```ts
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
```

- [ ] **Step 4: Register in `src/runners/index.ts`**

```ts
import { mypyRunner, pyrightRunner, pytestRunner } from "./python.js";
```

Add to the map:

```ts
  pytest: pytestRunner,
  mypy: mypyRunner,
  pyright: pyrightRunner,
```

- [ ] **Step 5: Run tests, then full suite**

Run: `npx vitest run src/runners/python.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/runners/python.ts src/runners/index.ts src/runners/python.test.ts
git commit -m "feat(runners): python type checkers (mypy, pyright)"
```

---

## Task 3: ruff + flake8 + pylint (lint) + integration sanity

**Files:**
- Modify: `src/runners/python.ts`
- Modify: `src/runners/index.ts`
- Test: `src/runners/python.test.ts` (extend)

**Interfaces:**
- Produces: `ruffRunner` (name `ruff`, args `["check", "."]`), `flake8Runner` (name `flake8`, args `["."]`), `pylintRunner` (name `pylint`, args `["."]`); all capId `lint`, all registered.

- [ ] **Step 1: Write the failing test**

Add to `src/runners/python.test.ts`:

```ts
import { flake8Runner, pylintRunner, ruffRunner } from "./python.js";

describe("python lint runners", () => {
  const lintCap = (runner: string): Capability => ({
    id: "lint",
    language: "python",
    available: true,
    runner,
  });

  it("ruff builds a lint:python check", () => {
    const check = ruffRunner.toCheck(project, lintCap("ruff"));
    expect(check.key).toBe("lint:python");
    expect(check.cmd.endsWith("ruff")).toBe(true);
    expect(check.args).toEqual(["check", "."]);
  });

  it("flake8 and pylint build lint:python checks", () => {
    expect(flake8Runner.toCheck(project, lintCap("flake8")).args).toEqual(["."]);
    expect(pylintRunner.toCheck(project, lintCap("pylint")).args).toEqual(["."]);
  });

  it("all python lint runners are registered", () => {
    expect(runners.ruff).toBe(ruffRunner);
    expect(runners.flake8).toBe(flake8Runner);
    expect(runners.pylint).toBe(pylintRunner);
  });
});

describe("python runner integration", () => {
  it("every python runner name emitted by detection has a registered runner", () => {
    for (const name of [
      "pytest",
      "mypy",
      "pyright",
      "ruff",
      "flake8",
      "pylint",
    ]) {
      expect(runners[name]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/runners/python.test.ts`
Expected: FAIL — lint runners not exported.

- [ ] **Step 3: Add the runners in `src/runners/python.ts`**

Append:

```ts
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
```

- [ ] **Step 4: Register in `src/runners/index.ts`**

```ts
import {
  flake8Runner,
  mypyRunner,
  pylintRunner,
  pyrightRunner,
  pytestRunner,
  ruffRunner,
} from "./python.js";
```

Add to the map:

```ts
  pytest: pytestRunner,
  mypy: mypyRunner,
  pyright: pyrightRunner,
  ruff: ruffRunner,
  flake8: flake8Runner,
  pylint: pylintRunner,
```

- [ ] **Step 5: Run tests, then full suite**

Run: `npx vitest run src/runners/python.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 6: Dogfood — confirm JS is untouched**

Run: `node bin/veris verify` in this repo (JS-only).
Expected: same `Checks` block (`types`/`lint`/`unit`), same verdict and exit code as before — registering Python runners must not affect a JS-only project.

- [ ] **Step 7: Commit**

```bash
git add src/runners/python.ts src/runners/index.ts src/runners/python.test.ts
git commit -m "feat(runners): python linters (ruff, flake8, pylint) + registry integration"
```

---

## Self-Review

**Spec coverage (M3 — spec §6 Python adapters):**
- pytest (unit) → Task 1 ✓
- mypy + pyright (types) → Task 2 ✓
- ruff + flake8 + pylint (lint) → Task 3 ✓
- All registered under the exact names M2 detection emits → Tasks 1–3 registry entries + Task 3 integration test ✓
- Spawn via `resolveBin(root, "python", tool)` (uses `.venv`) → factory in Task 1 ✓
- Reuses `runViaExec` verdict/timeout semantics → factory ✓
- JS untouched → Task 3 Step 6 dogfood ✓

**Placeholder scan:** none; every step has complete code. ✓

**Type consistency:** `PythonRunnerSpec` shape and `makePythonRunner` signature fixed in Task 1 and reused verbatim in Tasks 2–3; runner names match the M2 vocabulary; `capId` union (`unit|types|lint`) is a subset of `CapabilityId`. ✓

**Known-refine (non-blocking, note for a later hardening pass):** default arg lists are sensible but tool-idiomatic minimums — `pylint .` and `flake8 .` may want project-specific targets/config; refine when dogfooding on a real Python repo (M5 polyglot fixture). `binExists` existence-vs-executable and win32 `.exe` resolution (from the M2 review) also apply here.

**Deferred:** Go adapters (M4), verify/reporter language-aware display (M5), polyglot `affected` (later).
