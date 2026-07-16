# Polyglot Verification — Milestone 1: Model Reshape — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `Language` axis and a composite `${capability}:${language}` check key into the data model, thread it through the orchestrator, verdict, evidence, and reporters — with terminal output and exit codes byte-identical for today's JS-only projects.

**Architecture:** Today every check is keyed by `CapabilityId` alone, so there can only ever be one `unit`/`types`/`lint` check per project — that is the wall that blocks polyglot. This milestone adds `language` to `Capability` and `Check`, a composite `key` to `Check`, and migrates `CheckResult.checkId` and `Verdict` arrays to composite strings. No Python/Go detection or adapters yet (Milestones 2–4); every capability is tagged `language: "js"`, so the composite key is always `unit:js` etc. and behaves identically. Reporters render only the capability portion this milestone; the language dimension in the display is Milestone 5.

**Sequencing principle:** the type reshape is done green-at-every-commit — widen the types and populate the new fields first (no behavior change), then flip the identity to the composite key in a single atomic task. Every task ends with `npm run verify` green.

**Tech Stack:** TypeScript (strict, ESM, `.js` import specifiers), Vitest, Biome, tsup. No new dependencies.

## Global Constraints

- **No new runtime dependencies** — the `veriskit` CLI keeps its existing two.
- **ESM import specifiers end in `.js`** even for `.ts` sources (e.g. `import ... from "./model.js"`).
- **`veriskit`/`VerisKit` naming** — user-facing strings say VerisKit; the package/CLI is `veriskit`.
- **Byte-identical scope:** "byte-identical" means **terminal output and process exit codes** are unchanged for JS-only repos. On-disk evidence check ids intentionally gain a `:js` suffix (documented change); tests that assert on those strings are updated in the task that introduces the change.
- **Composite key format:** ``key = `${capabilityId}:${language}` ``, e.g. `unit:js`. Filesystem artifacts (log files) replace `:` with `-` for cross-platform safety.
- **Every task ends green:** each task finishes with `npm run verify` passing (tests + `tsc --noEmit` + Biome) before its commit.
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure

- `src/core/model.ts` — `Language`, `language`/`key` fields, migrated `checkId`/`Verdict` string types, `checkKey`/`splitKey` helpers. (Owns the type contract.)
- `src/config/detect.ts` — tag every detected capability `language: "js"`.
- `src/runners/base.ts` — `runViaExec` writes `CheckResult.checkId = check.key`.
- `src/runners/*.ts` (7 adapters) — each `toCheck` sets `language` + `key`.
- `src/core/verdict.ts` — match results by composite key; `verifiedCapabilities`/`skipped` become composite strings.
- `src/core/orchestrator.ts` + `orchestrate.ts` + `src/cli/commands/watch.ts` — synthetic `CheckResult.checkId` values become composite keys; orchestrator iterates capabilities.
- `src/evidence/store.ts` — sanitize `:` → `-` in log filenames.
- `src/reporters/terminal.ts` + `markdown.ts` — display the capability portion of the composite key.

---

## Task 1: `Language` type and key helpers

**Files:**
- Modify: `src/core/model.ts`
- Test: `src/core/model.test.ts` (create)

**Interfaces:**
- Produces:
  - `type Language = "js" | "python" | "go"`
  - `function checkKey(id: CapabilityId, language: Language): string` → `"${id}:${language}"`
  - `function splitKey(key: string): { id: string; language: string }` (a key with no `:` returns `{ id: key, language: "js" }`)

- [ ] **Step 1: Write the failing test**

Create `src/core/model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkKey, splitKey } from "./model.js";

describe("checkKey / splitKey", () => {
  it("builds a composite key", () => {
    expect(checkKey("unit", "python")).toBe("unit:python");
  });

  it("splits a composite key back into id and language", () => {
    expect(splitKey("unit:python")).toEqual({ id: "unit", language: "python" });
  });

  it("treats a bare id as js", () => {
    expect(splitKey("unit")).toEqual({ id: "unit", language: "js" });
  });

  it("round-trips every capability x language", () => {
    for (const id of ["types", "lint", "unit", "browser"] as const) {
      const k = checkKey(id, "js");
      expect(splitKey(k)).toEqual({ id, language: "js" });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/model.test.ts`
Expected: FAIL — `checkKey is not a function` / import error.

- [ ] **Step 3: Add the type and helpers to `src/core/model.ts`**

Alongside the existing type aliases at the top:

```ts
export type Language = "js" | "python" | "go"; // "js" covers TypeScript
```

At the bottom of the file:

```ts
export function checkKey(id: CapabilityId, language: Language): string {
  return `${id}:${language}`;
}

export function splitKey(key: string): { id: string; language: string } {
  const i = key.indexOf(":");
  if (i === -1) return { id: key, language: "js" };
  return { id: key.slice(0, i), language: key.slice(i + 1) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/model.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/model.ts src/core/model.test.ts
git commit -m "feat(model): add Language type and checkKey/splitKey helpers"
```

---

## Task 2: Add `language` to `Capability` (populate, no behavior change)

Adds the required `language` field to `Capability` and populates it everywhere a `Capability` is constructed. No logic reads it yet, so behavior is unchanged. The build breaks only where a **typed** `Capability`/`Project` literal omits the field — those are updated here so the suite stays green.

**Files:**
- Modify: `src/core/model.ts`
- Modify: `src/config/detect.ts`
- Modify tests (typed literals that will no longer compile): `src/core/verdict.test.ts`, `src/core/orchestrate.test.ts`

**Interfaces:**
- Consumes: `Language` from Task 1.
- Produces: `Capability` gains required `language: Language`.

- [ ] **Step 1: Add the field to `src/core/model.ts`**

```ts
export interface Capability {
  id: CapabilityId;
  language: Language; // NEW
  available: boolean;
  runner?: string;
  reason?: string;
}
```

- [ ] **Step 2: Run typecheck to see what breaks**

Run: `npx tsc --noEmit`
Expected: errors in `src/config/detect.ts` and any test with a typed (non-cast) `Capability`/`Project` literal — `verdict.test.ts`, `orchestrate.test.ts`. (Cast literals like `... as Project` in `orchestrator.test.ts` and the runner tests still compile; they are handled in later tasks where their runtime value matters.)

- [ ] **Step 3: Populate `language: "js"` in `src/config/detect.ts`**

Every `Capability` literal returned by `detectTypes`, `detectUnit`, `detectLint`, and `detectBrowser` (both the available and the unavailable branch) gains `language: "js"`. Example for `detectTypes`:

```ts
function detectTypes(root: string, has: (n: string) => boolean): Capability {
  if (existsSync(join(root, "tsconfig.json")) && has("typescript"))
    return { id: "types", language: "js", available: true, runner: "tsc" };
  return {
    id: "types",
    language: "js",
    available: false,
    reason: "no tsconfig.json + typescript dependency",
  };
}
```

- [ ] **Step 4: Fix the typed test literals**

In `src/core/verdict.test.ts`, add `language: "js"` to every object in the `caps` array and in the inline `allCaps` / `availableCaps` arrays and the `browser` capability literal passed to `computeVerdict`. Example:

```ts
const caps: Capability[] = [
  { id: "types", language: "js", available: true, runner: "tsc" },
  { id: "unit", language: "js", available: true, runner: "vitest" },
  { id: "lint", language: "js", available: false, reason: "no linter configured" },
];
```

In `src/core/orchestrate.test.ts`, the `project()` helper returns a typed `Project`; add `language: "js"` to both capability literals:

```ts
capabilities: [
  { id: "unit", language: "js", available: true, runner: "vitest" },
  { id: "browser", language: "js", available: browserAvailable, runner: "playwright" },
],
```

- [ ] **Step 5: Run the full suite**

Run: `npm run verify`
Expected: PASS — compiles clean, all existing tests green, no behavior change.

- [ ] **Step 6: Commit**

```bash
git add src/core/model.ts src/config/detect.ts src/core/verdict.test.ts src/core/orchestrate.test.ts
git commit -m "feat(model): add language field to Capability, tag detection as js"
```

---

## Task 3: Add `language` + `key` to `Check` (populate in runners, no behavior change)

Adds `language` and `key` to `Check` and has every runner populate them from the capability. `runViaExec` still emits the bare `check.id` as `checkId` (the flip happens in Task 5), so behavior is unchanged.

**Files:**
- Modify: `src/core/model.ts`
- Modify: `src/runners/tsc.ts`, `vitest.ts`, `jest.ts`, `node-test.ts`, `eslint.ts`, `biome.ts`, `playwright.ts`
- Modify tests: `src/runners/tsc.test.ts`, `vitest.test.ts`, `lint.test.ts`, `playwright.test.ts`

**Interfaces:**
- Consumes: `checkKey` from Task 1; `Capability.language` from Task 2.
- Produces: `Check` gains required `language: Language` and `key: string` (`= checkKey(id, language)`).

- [ ] **Step 1: Add the fields to `src/core/model.ts`**

```ts
export interface Check {
  id: CapabilityId;
  language: Language; // NEW
  key: string;        // NEW — checkKey(id, language)
  title: string;
  runner: string;
  cmd: string;
  args: string[];
}
```

- [ ] **Step 2: Run typecheck to see what breaks**

Run: `npx tsc --noEmit`
Expected: errors in each `src/runners/*.ts` whose `toCheck` builds a `Check` literal without `language`/`key`.

- [ ] **Step 3: Populate `language` + `key` in every runner's `toCheck`**

Import `checkKey` and set both fields from the capability. `src/runners/vitest.ts` in full:

```ts
import { type Capability, type Check, checkKey, type CheckResult, type Project } from "../core/model.js";
import { localBin, type RunContext, type Runner, runViaExec } from "./base.js";

export const vitestRunner: Runner = {
  id: "vitest",
  toCheck(project: Project, cap: Capability, opts?: { targetFiles?: string[] }): Check {
    const files = opts?.targetFiles ?? [];
    return {
      id: "unit",
      language: cap.language,
      key: checkKey("unit", cap.language),
      title: "Unit tests",
      runner: "vitest",
      cmd: localBin(project.root, "vitest"),
      args: ["run", "--reporter=json", ...files],
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
```

Apply the identical addition — import `checkKey`, set `language: cap.language` and `key: checkKey(<id>, cap.language)` — to `tsc.ts` (id `"types"`), `jest.ts` (`"unit"`), `node-test.ts` (`"unit"`), `eslint.ts` (`"lint"`), `biome.ts` (`"lint"`), and `playwright.ts` (`"browser"`). Do NOT change any `checkId` values in this task.

- [ ] **Step 4: Update runner tests to pass `language` and assert `key`**

In `src/runners/tsc.test.ts`, `vitest.test.ts`, `lint.test.ts`, and `playwright.test.ts`, add `language: "js"` to each `Capability` literal handed to `toCheck` (drop any now-redundant `as Capability` cast where the literal is complete) and assert the produced `key`. For `tsc.test.ts`:

```ts
it("builds a --noEmit check", () => {
  const check = tscRunner.toCheck(
    { root: "/tmp/x" } as Project,
    { id: "types", language: "js", available: true, runner: "tsc" },
  );
  expect(check.args).toContain("--noEmit");
  expect(check.id).toBe("types");
  expect(check.key).toBe("types:js");
  expect(check.cmd).toContain(join("node_modules", ".bin", "tsc"));
});
```

- [ ] **Step 5: Run the full suite**

Run: `npm run verify`
Expected: PASS — compiles clean, all tests green, no behavior change (checkId still bare).

- [ ] **Step 6: Commit**

```bash
git add src/core/model.ts src/runners
git commit -m "feat(model): add language + key to Check, populate in all runners"
```

---

## Task 4: Filesystem-safe log filenames

Independent robustness change so that when composite keys become log filenames in Task 5, a `:` never reaches the filesystem. Safe to land now (today's bare ids have no `:`, so behavior is unchanged).

**Files:**
- Modify: `src/evidence/store.ts`
- Test: `src/evidence/store.test.ts` (create if absent, else extend)

**Interfaces:**
- Produces: `writeLog` and `readRunLogs` map `:` → `-` in the on-disk filename (`unit:js` → `unit-js.log`). In-memory map keys and `CheckResult.checkId` stay composite.

- [ ] **Step 1: Write the failing test**

Create/extend `src/evidence/store.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeLog } from "./store.js";

describe("writeLog", () => {
  it("sanitizes ':' out of the log filename", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-log-"));
    const ref = await writeLog(dir, "unit:js", "hello\n");
    expect(ref.endsWith("unit-js.log")).toBe(true);
    expect(await readFile(ref, "utf8")).toBe("hello\n");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/evidence/store.test.ts`
Expected: FAIL — filename is `unit:js.log`.

- [ ] **Step 3: Sanitize the filename in `src/evidence/store.ts`**

Add a helper and use it in `writeLog` and `readRunLogs`:

```ts
function logFileName(checkId: string): string {
  return `${checkId.replace(/:/g, "-")}.log`;
}
```

```ts
export async function writeLog(
  runDir: string,
  checkId: string,
  content: string,
): Promise<string> {
  const ref = join(runDir, logFileName(checkId));
  await writeFile(ref, content, "utf8");
  return ref;
}
```

```ts
export async function readRunLogs(
  runDir: string,
  checkIds: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of checkIds) {
    try {
      out[id] = await readFile(join(runDir, logFileName(id)), "utf8");
    } catch {
      // no log for this check
    }
  }
  return out;
}
```

`digestLogs` reads from `r.logRef` directly, so it needs no change.

- [ ] **Step 4: Run the full suite**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/evidence/store.ts src/evidence/store.test.ts
git commit -m "fix(evidence): sanitize ':' from log filenames for composite keys"
```

---

## Task 5: Flip the identity to the composite key (atomic)

The only behavior-affecting task. `CheckResult.checkId` and the `Verdict` arrays become composite strings; producers emit `check.key`; the verdict matches by composite key; the orchestrator iterates capabilities; reporters render the capability portion so JS-only output is byte-identical. All steps land together (the `checkId` type change touches producers and consumers at once); run the suite at the end.

**Files:**
- Modify: `src/core/model.ts` (`CheckResult.checkId: string`; `Verdict.verifiedCapabilities`/`skipped`: `string[]`)
- Modify: `src/runners/base.ts`, `src/runners/playwright.ts`
- Modify: `src/core/orchestrator.ts`, `src/core/orchestrate.ts`, `src/cli/commands/watch.ts`
- Modify: `src/core/verdict.ts`
- Modify: `src/reporters/terminal.ts`, `src/reporters/markdown.ts`
- Modify tests: `src/core/verdict.test.ts`, `src/core/orchestrator.test.ts`

**Interfaces:**
- Consumes: `checkKey`, `splitKey` (Task 1); `Capability.language` (Task 2); `Check.key` (Task 3).
- Produces: every `CheckResult.checkId` is a composite key; `computeVerdict` returns composite keys; reporters display `splitKey(checkId).id`.

- [ ] **Step 1: Migrate the types in `src/core/model.ts`**

```ts
export interface CheckResult {
  checkId: string; // composite key, e.g. "unit:js"
  status: CheckStatus;
  durationMs: number;
  summary: string;
  logRef?: string;
  outputTail?: string;
  counts?: { passed?: number; failed?: number; total?: number };
  cached?: boolean;
}
```

```ts
export interface Verdict {
  state: VerdictState;
  verifiedCapabilities: string[]; // composite keys
  skipped: string[];              // composite keys
  reasons: string[];
}
```

- [ ] **Step 2: Emit `check.key` from `src/runners/base.ts`**

In `runViaExec`, change the log write and the result id:

```ts
const logRef = await writeLog(ctx.runDir, check.key, `${output}\n`);
const result: CheckResult = {
  checkId: check.key,
  status,
  durationMs: r.durationMs,
  summary:
    status === "passed" ? opts.pass : r.timedOut ? "timed out" : opts.fail,
  logRef,
};
```

- [ ] **Step 3: Emit `check.key` on the browser path in `src/runners/playwright.ts`**

The synthetic result literal on the browser path changes `checkId: "browser"` to `checkId: check.key`.

- [ ] **Step 4: Iterate capabilities and emit composite keys in `src/core/orchestrator.ts`**

```ts
import { createRunDir, newRunId } from "../evidence/store.js";
import { runners } from "../runners/index.js";
import { getEnvironmentInfo } from "../util/env.js";
import {
  type CapabilityId,
  checkKey,
  type CheckResult,
  type Project,
  type VerificationRun,
} from "./model.js";
import { computeVerdict } from "./verdict.js";

export async function runChecks(
  project: Project,
  ids: CapabilityId[],
  root: string,
  opts: { targetFiles?: Partial<Record<CapabilityId, string[]>> } = {},
): Promise<VerificationRun> {
  const known = new Set(project.capabilities.map((c) => c.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown check id(s): ${unknown.join(", ")}`);
  }

  const id = newRunId();
  const runDir = await createRunDir(root, id);
  const ctx = { root, runDir };

  const requested = project.capabilities.filter((c) => ids.includes(c.id));

  const tasks = requested.map(async (cap): Promise<CheckResult> => {
    const key = checkKey(cap.id, cap.language);
    const runner = cap.runner ? runners[cap.runner] : undefined;
    if (!cap.available || !runner) {
      const summary = !cap.available
        ? (cap.reason ?? "not configured")
        : `no runner registered for ${cap.runner}`;
      return { checkId: key, status: "skipped", durationMs: 0, summary };
    }
    const check = runner.toCheck(project, cap, {
      targetFiles: opts.targetFiles?.[cap.id],
    });
    return runner.run(check, ctx);
  });

  const results = await Promise.all(tasks);
  const verdict = computeVerdict(results, requested);

  return {
    id,
    startedAt: new Date().toISOString(),
    project,
    results,
    verdict,
    env: getEnvironmentInfo(project.packageManager),
  };
}
```

- [ ] **Step 5: Composite key on the "not affected" path in `src/core/orchestrate.ts`**

Add `checkKey` to the model import and update the synthetic loop:

```ts
import { type CapabilityId, checkKey, type Project, type VerificationRun } from "./model.js";
```

```ts
  const affected = new Set(plan.checks);
  for (const cap of project.capabilities) {
    if (cap.available && cap.id !== "browser" && !affected.has(cap.id)) {
      run.results.push({
        checkId: checkKey(cap.id, cap.language),
        status: "skipped",
        durationMs: 0,
        summary: "not affected by changes",
      });
    }
  }
```

- [ ] **Step 6: Composite key on the synthetic skip in `src/cli/commands/watch.ts`**

At the synthetic result (`watch.ts:32`), change `checkId: cap.id` to `checkId: checkKey(cap.id, cap.language)` and import `checkKey` from `../../core/model.js`. The `freshById` (line 17) and cache maps (line 92) key on `r.checkId`, so they carry composite keys through unchanged.

- [ ] **Step 7: Match by composite key in `src/core/verdict.ts`**

```ts
import {
  type Capability,
  type CheckResult,
  checkKey,
  type Verdict,
} from "./model.js";

export function computeVerdict(
  results: CheckResult[],
  capabilities: Capability[],
): Verdict {
  const reasons: string[] = [];
  const skipped: string[] = [];
  const verifiedCapabilities: string[] = [];

  const anyFailed = results.some((r) => r.status === "failed");

  for (const cap of capabilities) {
    const key = checkKey(cap.id, cap.language);
    const result = results.find((r) => r.checkId === key);

    if (!cap.available) {
      skipped.push(key);
      reasons.push(`${cap.id} skipped — ${cap.reason ?? "not configured"}`);
      continue;
    }
    if (result?.status === "passed") {
      verifiedCapabilities.push(key);
      continue;
    }
    if (result?.status === "failed") {
      reasons.push(`${cap.id} failed — ${result.summary}`);
      continue;
    }
    skipped.push(key);
    reasons.push(`${cap.id} skipped — ${result?.summary ?? "did not run"}`);
  }

  let state: Verdict["state"];
  if (anyFailed) state = "failed";
  else if (skipped.length > 0) state = "partial";
  else state = "verified";

  return { state, verifiedCapabilities, skipped, reasons };
}
```

`verdictExitCode` is unchanged. `reasons` keep the bare `cap.id` for stable human text.

- [ ] **Step 8: Render the capability portion in reporters**

In `src/reporters/terminal.ts`, import `splitKey` and change the row label (currently line 55):

```ts
import { splitKey } from "../core/model.js";
```

```ts
    const label = splitKey(r.checkId).id;
    lines.push(`  ${g} ${label.padEnd(14)} ${detail}`);
```

In `src/reporters/markdown.ts`, import `splitKey` and change the two rows that print `r.checkId` (lines 52 and 67):

```ts
      `| ${splitKey(r.checkId).id} | ${r.status} | ${dur} | ${cell(r.summary)} | ${log} |`,
```

```ts
      lines.push(`### ${splitKey(r.checkId).id}`);
```

- [ ] **Step 9: Update consumer test expectations**

In `src/core/verdict.test.ts`: change each `res("types", ...)` to `res("types:js", ...)` (same for `unit`, `lint`), the unregistered-runner synthetic result `checkId: "lint"` to `"lint:js"`, and every assertion `toContain("lint")`/`not.toContain("lint")`/`toContain("browser")` to the composite form (`"lint:js"`, `"browser:js"`).

In `src/core/orchestrator.test.ts`: add `language: "js"` to the cast `Project` fixtures' capability literals (so the emitted key is `lint:js`, not `lint:undefined`), change `expect(run.results[0]?.checkId).toBe("lint")` to `toBe("lint:js")`, and `verdict.skipped` assertions from `toContain("lint")`/`not.toContain("types")` to `toContain("lint:js")`/`not.toContain("types:js")`.

(Reporter tests use bare-string `checkId`s; `splitKey("types").id === "types"`, so they need no change.)

- [ ] **Step 10: Run the full suite**

Run: `npm run verify`
Expected: PASS — all tests green, `tsc --noEmit` clean, Biome clean.

- [ ] **Step 11: Dogfood — confirm byte-identical terminal output**

Run: `node bin/veris verify` in this repo (a JS-only project).
Expected: the `Checks` block shows `types`, `lint`, `unit` exactly as before — no `:js` suffix visible — verdict and exit code unchanged from `main`.

- [ ] **Step 12: Commit**

```bash
git add src/core/model.ts src/runners/base.ts src/runners/playwright.ts src/core/orchestrator.ts src/core/orchestrate.ts src/cli/commands/watch.ts src/core/verdict.ts src/reporters src/core/verdict.test.ts src/core/orchestrator.test.ts
git commit -m "refactor: key checks and verdicts by composite capability:language"
```

---

## Self-Review

**Spec coverage (Milestone 1 scope only):**
- `Language` type + `language` on Capability/Check → Tasks 1, 2, 3 ✓
- Composite `key` on Check; `CheckResult.checkId`/`Verdict` migrated to strings → Tasks 1, 3, 5 ✓
- Orchestrator forward-compatible with multiple languages per id → Task 5 ✓
- JS behavior byte-identical (terminal + exit codes) → Task 5 (stable reason text, `splitKey` display), Step 11 dogfood ✓
- Evidence/log plumbing carries composite keys safely → Task 4 ✓
- Green at every commit → each task runs `npm run verify` before committing ✓
- No Python/Go detection or adapters (correctly deferred to M2–M4) ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `checkKey`/`splitKey` signatures identical across Tasks 1, 3, 5. `Capability.language` (T2), `Check.language`/`key` (T3), `CheckResult.checkId: string` / `Verdict.*: string[]` (T5) introduced in dependency order; no task references a field before the task that adds it. ✓

**Deferred to later milestones (out of scope here):** language-aware reporter display showing the language (M5), pytest/go/mypy/ruff/golangci-lint adapters (M2–M4), Python/Go detection + `resolveBin` + config schema (M2).
