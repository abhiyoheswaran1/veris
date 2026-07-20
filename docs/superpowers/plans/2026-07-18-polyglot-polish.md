# Polyglot Verification — Pre-0.7.0 Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the non-blocking polish items surfaced by the v0.7 milestone reviews, so `main` is release-ready before the eventual `0.7.0` cut: (1) language-qualified skip/fail reasons on polyglot runs, (2) DRY the two identical runner factories into one, (3) harden `binExists` (executable, not merely present) + `resolveBin` Windows resolution, (4) fix `pylint` recursion default + the double config read in `verifyProject`.

**Architecture:** All changes are behavior-preserving for JS-only projects. The verdict-reason qualifier reuses the same "only when >1 language" rule the reporters use. The DRY refactor introduces a single `makeExecRunner(language, spec)` in `runners/base.ts` and rebuilds the six Python + four Go runners on it (identical output). The `resolve-bin` and `verifyProject` changes are correctness hardening.

**Tech Stack:** TypeScript (strict, ESM, `.js` specifiers), Vitest, Biome. No new dependencies. No version bump — `package.json` stays `0.6.1`.

## Global Constraints

- **No new runtime dependencies; no version bump (`package.json` stays `0.6.1`).**
- **ESM import specifiers end in `.js`; `veriskit`/`VerisKit` naming; TypeScript strict.**
- **JS-only behavior unchanged:** verify terminal output, exit codes, and single-language verdict reasons stay byte-identical.
- **Every task ends green:** `npm run verify` passes before each commit.
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure

- `src/core/verdict.ts` — language-qualify reason strings only when the capability set spans >1 language.
- `src/runners/base.ts` — NEW `makeExecRunner(language, spec)` + `ExecRunnerSpec`.
- `src/runners/python.ts` / `src/runners/go.ts` — rebuild runners on `makeExecRunner`; drop the per-language factory.
- `src/util/resolve-bin.ts` — `binExists` checks executability; `resolveBin` tries name variants (Windows).
- `src/core/orchestrate.ts` + `src/config/detect.ts` — single config load in `verifyProject`.
- Test files alongside each.

---

## Task 1: Language-qualified verdict reasons (polyglot only)

**Files:**
- Modify: `src/core/verdict.ts`
- Modify: `src/core/verdict.test.ts`

**Interfaces:**
- Produces: `computeVerdict` reason strings read `unit (python) skipped — …` when the capability set spans >1 language, and stay `unit skipped — …` for a single-language run. `skipped`/`verifiedCapabilities` arrays (composite keys) are unchanged.

- [ ] **Step 1: Write the failing test**

Add to `src/core/verdict.test.ts`:

```ts
describe("computeVerdict — polyglot reasons", () => {
  it("qualifies reasons with the language when the run spans languages", () => {
    const caps: Capability[] = [
      { id: "unit", language: "js", available: true, runner: "vitest" },
      {
        id: "unit",
        language: "python",
        available: false,
        reason: "Python detected; pytest not installed",
      },
    ];
    const v = computeVerdict([res("unit:js", "passed")], caps);
    expect(v.state).toBe("partial");
    expect(v.reasons.some((r) => r.startsWith("unit (python) skipped"))).toBe(
      true,
    );
  });

  it("does not qualify reasons for a single-language run", () => {
    const caps: Capability[] = [
      { id: "lint", language: "js", available: false, reason: "no linter configured" },
    ];
    const v = computeVerdict([], caps);
    expect(v.reasons.some((r) => r.startsWith("lint skipped"))).toBe(true);
    expect(v.reasons.some((r) => r.includes("(js)"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/core/verdict.test.ts`
Expected: FAIL — reasons currently always use the bare `cap.id`, so the polyglot case has no `(python)` qualifier.

- [ ] **Step 3: Qualify reasons in `src/core/verdict.ts`**

Add a span check + label helper before the loop and use it in all three `reasons.push` calls:

```ts
  const anyFailed = results.some((r) => r.status === "failed");
  const spans = new Set(capabilities.map((c) => c.language)).size > 1;
  const labelOf = (cap: Capability) =>
    spans ? `${cap.id} (${cap.language})` : cap.id;

  for (const cap of capabilities) {
    const key = checkKey(cap.id, cap.language);
    const result = results.find((r) => r.checkId === key);

    if (!cap.available) {
      skipped.push(key);
      reasons.push(`${labelOf(cap)} skipped — ${cap.reason ?? "not configured"}`);
      continue;
    }
    if (result?.status === "passed") {
      verifiedCapabilities.push(key);
      continue;
    }
    if (result?.status === "failed") {
      reasons.push(`${labelOf(cap)} failed — ${result.summary}`);
      continue;
    }
    skipped.push(key);
    reasons.push(`${labelOf(cap)} skipped — ${result?.summary ?? "did not run"}`);
  }
```

- [ ] **Step 4: Run tests, then full suite**

Run: `npx vitest run src/core/verdict.test.ts && npm run verify`
Expected: PASS — existing single-language verdict tests unchanged (they assert state / composite-key arrays, not reason prefixes), new polyglot test passes.

- [ ] **Step 5: Commit**

```bash
git add src/core/verdict.ts src/core/verdict.test.ts
git commit -m "fix(verdict): language-qualify skip/fail reasons on polyglot runs"
```

---

## Task 2: DRY the runner factories into `makeExecRunner`

**Files:**
- Modify: `src/runners/base.ts`
- Modify: `src/runners/python.ts`
- Modify: `src/runners/go.ts`
- Test: `src/runners/python.test.ts`, `src/runners/go.test.ts` (should pass UNCHANGED — this is a pure refactor)

**Interfaces:**
- Consumes: `checkKey`, `Language`, `Capability`, `Check`, `CheckResult`, `Project` from `../core/model.js`; `resolveBin` from `../util/resolve-bin.js`.
- Produces: `makeExecRunner(language: Language, spec: ExecRunnerSpec): Runner` in `base.ts`, where `ExecRunnerSpec = { runner: string; capId: "unit"|"types"|"lint"; tool: string; args: string[]; title: string; pass: string; fail: string; timeoutMs: number }`. `makePythonRunner`/`makeGoRunner` are removed; all ten runner instances keep the same exported names and identical `toCheck`/`run` output.

- [ ] **Step 1: Add `makeExecRunner` to `src/runners/base.ts`**

Add the import of `checkKey`/`Language`/`resolveBin` (extend the existing model import; add the resolve-bin import) and the factory:

```ts
import {
  type Capability,
  type Check,
  checkKey,
  type CheckResult,
  type Language,
  type Project,
} from "../core/model.js";
import { writeLog } from "../evidence/store.js";
import { exec } from "../util/exec.js";
import { resolveBin } from "../util/resolve-bin.js";
```

```ts
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
```

(Confirm no import cycle: `resolve-bin.ts` imports only from `core/model.js`, so `base.ts → resolve-bin.ts` is acyclic.)

- [ ] **Step 2: Rebuild `src/runners/python.ts` on `makeExecRunner`**

Replace the whole file body so each runner is `makeExecRunner("python", {...})` with the SAME spec values as today (do not change any args — `pytest -q`, `mypy .`, `pyright` [], `ruff check .`, `flake8 .`, `pylint .`). Remove `makePythonRunner` and now-unused imports (`checkKey`, `resolveBin`, model types) — import only `makeExecRunner` from `./base.js`:

```ts
import { makeExecRunner } from "./base.js";

export const pytestRunner = makeExecRunner("python", {
  runner: "pytest",
  capId: "unit",
  tool: "pytest",
  args: ["-q"],
  title: "Unit tests (Python)",
  pass: "pytest passed",
  fail: "pytest failed",
  timeoutMs: 10 * 60_000,
});

export const mypyRunner = makeExecRunner("python", {
  runner: "mypy",
  capId: "types",
  tool: "mypy",
  args: ["."],
  title: "Type check (mypy)",
  pass: "no type errors",
  fail: "type errors",
  timeoutMs: 5 * 60_000,
});

export const pyrightRunner = makeExecRunner("python", {
  runner: "pyright",
  capId: "types",
  tool: "pyright",
  args: [],
  title: "Type check (pyright)",
  pass: "no type errors",
  fail: "type errors",
  timeoutMs: 5 * 60_000,
});

export const ruffRunner = makeExecRunner("python", {
  runner: "ruff",
  capId: "lint",
  tool: "ruff",
  args: ["check", "."],
  title: "Lint (ruff)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const flake8Runner = makeExecRunner("python", {
  runner: "flake8",
  capId: "lint",
  tool: "flake8",
  args: ["."],
  title: "Lint (flake8)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const pylintRunner = makeExecRunner("python", {
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

- [ ] **Step 3: Rebuild `src/runners/go.ts` on `makeExecRunner`**

Same treatment — `makeExecRunner("go", {...})` for `goTestRunner`, `goBuildRunner`, `golangciLintRunner`, `goVetRunner` with the SAME spec values as today (`go test ./...`, `go build ./...`, `golangci-lint run`, `go vet ./...`). Remove `makeGoRunner` and now-unused imports; import only `makeExecRunner` from `./base.js`:

```ts
import { makeExecRunner } from "./base.js";

export const goTestRunner = makeExecRunner("go", {
  runner: "go-test",
  capId: "unit",
  tool: "go",
  args: ["test", "./..."],
  title: "Unit tests (Go)",
  pass: "go test passed",
  fail: "go test failed",
  timeoutMs: 10 * 60_000,
});

export const goBuildRunner = makeExecRunner("go", {
  runner: "go-build",
  capId: "types",
  tool: "go",
  args: ["build", "./..."],
  title: "Compile (go build)",
  pass: "compiles",
  fail: "compile errors",
  timeoutMs: 5 * 60_000,
});

export const golangciLintRunner = makeExecRunner("go", {
  runner: "golangci-lint",
  capId: "lint",
  tool: "golangci-lint",
  args: ["run"],
  title: "Lint (golangci-lint)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const goVetRunner = makeExecRunner("go", {
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

- [ ] **Step 4: Run the full suite (existing runner tests must pass UNCHANGED)**

Run: `npm run verify`
Expected: PASS — `python.test.ts` and `go.test.ts` pass without edits (same `toCheck` output, same keys, same registry). If any assertion fails, a spec value drifted — fix the value, do not edit the test.

- [ ] **Step 5: Commit**

```bash
git add src/runners/base.ts src/runners/python.ts src/runners/go.ts
git commit -m "refactor(runners): collapse python/go factories into makeExecRunner"
```

---

## Task 3: Harden `binExists` (executable) + `resolveBin` (Windows variants)

**Files:**
- Modify: `src/util/resolve-bin.ts`
- Modify: `src/util/resolve-bin.test.ts`

**Interfaces:**
- Produces: `binExists` returns true only for an executable regular file (not a directory or a present-but-non-executable file on POSIX); `resolveBin` tries the platform name variants in each search dir (so a Windows `.venv\Scripts\pytest.exe` resolves).

- [ ] **Step 1: Write the failing tests**

Add to `src/util/resolve-bin.test.ts`:

```ts
describe("binExists — executability", () => {
  it("returns false for a present but non-executable file (POSIX)", () => {
    if (process.platform === "win32") return; // extension implies executable on win32
    const root = tmp();
    const bin = join(root, ".venv", "bin");
    mkdirSync(bin, { recursive: true });
    const p = join(bin, "ruff");
    writeFileSync(p, "#!/bin/sh\n");
    chmodSync(p, 0o644); // not executable
    expect(binExists(root, "python", "ruff")).toBe(false);
  });

  it("returns false for a directory named like the tool", () => {
    const root = tmp();
    mkdirSync(join(root, ".venv", "bin", "pytest"), { recursive: true });
    expect(binExists(root, "python", "pytest")).toBe(false);
  });
});
```

(These use `mkdirSync`, `writeFileSync`, `chmodSync`, `join` — already imported at the top of the existing test file.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/util/resolve-bin.test.ts`
Expected: FAIL — current `binExists` uses `existsSync`, so a non-executable file and a directory both return true.

- [ ] **Step 3: Harden `src/util/resolve-bin.ts`**

Add the executability helper and use it in `binExists`; make `resolveBin` try name variants:

```ts
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Language } from "../core/model.js";
```

Keep `searchDirs`, `pathDirs`, `nameVariants` as they are. Add:

```ts
// True only for a regular file that is executable. On Windows an extension
// match (via nameVariants) implies executability, so isFile() is enough.
function isExecutableFile(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false;
    if (process.platform === "win32") return true;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
```

Update `resolveBin` to try variants:

```ts
export function resolveBin(
  root: string,
  language: Language,
  name: string,
): string {
  for (const dir of searchDirs(root, language)) {
    for (const variant of nameVariants(name)) {
      const p = join(dir, variant);
      if (existsSync(p)) return p;
    }
  }
  if (language === "js") return join(root, "node_modules", ".bin", name);
  return name;
}
```

Update `binExists` to require executability:

```ts
export function binExists(
  root: string,
  language: Language,
  name: string,
): boolean {
  for (const dir of [...searchDirs(root, language), ...pathDirs()]) {
    for (const variant of nameVariants(name)) {
      if (isExecutableFile(join(dir, variant))) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run tests, then full suite**

Run: `npx vitest run src/util/resolve-bin.test.ts && npm run verify`
Expected: PASS — the existing `binExists` tests (which `chmod 0o755`) still pass; the new non-executable/directory cases now correctly return false. Detection tests (which install tools with `0o755`) are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/util/resolve-bin.ts src/util/resolve-bin.test.ts
git commit -m "fix(resolve-bin): require executable file in binExists; try name variants in resolveBin"
```

---

## Task 4: `pylint` recursion default + single config load in `verifyProject`

**Files:**
- Modify: `src/runners/python.ts`
- Modify: `src/runners/python.test.ts`
- Modify: `src/config/detect.ts`
- Modify: `src/core/orchestrate.ts`
- Test: `src/config/detect.test.ts` (extend)

**Interfaces:**
- Produces: `pylintRunner` args become `["--recursive=y", "."]`; `detectProject(root, config?)` only loads config when `config === undefined` (an explicit `null` is honored, no reload); `verifyProject` loads config once and threads it to `detectProject`.

- [ ] **Step 1: Write the failing tests**

In `src/runners/python.test.ts`, update the pylint assertion (find the existing `pylintRunner` args expectation and change it):

```ts
expect(pylintRunner.toCheck(project, lintCap("pylint")).args).toEqual([
  "--recursive=y",
  ".",
]);
```

In `src/config/detect.test.ts`, add:

```ts
describe("detectProject — explicit null config", () => {
  it("treats an explicit null config as 'no config' without crashing", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-null-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
    const project = await detectProject(root, null);
    expect(project.capabilities.every((c) => c.language === "js")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/runners/python.test.ts src/config/detect.test.ts`
Expected: pylint assertion FAILS (args are still `["."]`). The null-config test likely passes already (via `??`), but Step 3 makes the semantics explicit.

- [ ] **Step 3: Change the pylint args in `src/runners/python.ts`**

```ts
export const pylintRunner = makeExecRunner("python", {
  runner: "pylint",
  capId: "lint",
  tool: "pylint",
  args: ["--recursive=y", "."],
  title: "Lint (pylint)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});
```

- [ ] **Step 4: Distinguish "not passed" from "explicit null" in `src/config/detect.ts`**

Change the config resolution line so an explicit `null` is honored (avoids a second disk read when a caller already loaded and found nothing):

```ts
  const cfg = config === undefined ? await loadConfig(root) : config;
```

(Replaces `const cfg = config ?? (await loadConfig(root));`.)

- [ ] **Step 5: Load config once in `verifyProject` (`src/core/orchestrate.ts`)**

Change the head of `verifyProject` so config is read once and threaded into `detectProject`:

```ts
export async function verifyProject(
  root: string,
  opts: { partialOk?: boolean; browser?: boolean } = {},
): Promise<{ run: VerificationRun; record: EvidenceRecord }> {
  const config = await loadConfig(root);
  const project = await detectProject(root, config);
  const checks = resolveChecks(config?.checks, project, opts);
  const run = await runChecks(project, checks, root);
  // ...unchanged below...
```

(The `loadConfig` import already exists in this file.)

- [ ] **Step 6: Run tests, then full suite + dogfood**

Run: `npx vitest run src/runners/python.test.ts src/config/detect.test.ts && npm run verify`
Expected: PASS.

Run: `node bin/veris verify` (JS-only) — confirm output/verdict/exit code unchanged (config threading and pylint arg do not touch a JS-only run).

- [ ] **Step 7: Commit**

```bash
git add src/runners/python.ts src/runners/python.test.ts src/config/detect.ts src/core/orchestrate.ts src/config/detect.test.ts
git commit -m "fix: pylint --recursive default + single config load in verifyProject"
```

---

## Self-Review

**Coverage of the logged polish items:**
- Skip/fail reason language qualifier (polyglot only) → Task 1 ✓
- DRY python/go factories → one `makeExecRunner` → Task 2 ✓
- `binExists` existence-vs-executable + `resolveBin` win32 variants → Task 3 ✓
- `pylint` recursion default → Task 4 ✓
- Double config read in `verifyProject` (+ explicit-null semantics) → Task 4 ✓
- No version bump; JS-only behavior unchanged → constraints + Task 4 dogfood ✓

**Placeholder scan:** none; every step has complete code. ✓

**Type consistency:** `ExecRunnerSpec`/`makeExecRunner` fixed in Task 2 and consumed by Tasks 2/4; `detectProject(root, config?)` signature unchanged (only its internal null handling changes); reason-label rule mirrors the reporter's `runSpansLanguages`. ✓

**Still deferred (genuinely needs a real polyglot repo to tune, out of scope here):** per-tool arg configurability beyond pylint (e.g. `go vet`/`golangci-lint` targets for non-root modules), and non-hermetic detection presence tests. These require dogfooding on an actual multi-language repository.
