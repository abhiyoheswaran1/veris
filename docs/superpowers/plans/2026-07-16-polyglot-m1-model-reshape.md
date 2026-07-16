# Polyglot Verification — Milestone 1: Model Reshape — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `Language` axis and a composite `${capability}:${language}` check key into the data model, thread it through the orchestrator, verdict, evidence, and reporters — with terminal output and exit codes byte-identical for today's JS-only projects.

**Architecture:** Today every check is keyed by `CapabilityId` alone, so there can only ever be one `unit`/`types`/`lint` check per project — that is the wall that blocks polyglot. This milestone adds `language` to `Capability` and `Check`, a composite `key` to `Check`, and migrates `CheckResult.checkId` and `Verdict` arrays to composite strings. No Python/Go detection or adapters yet (Milestones 2–4); every capability is tagged `language: "js"`, so the composite key is always `unit:js` etc. and behaves identically. Reporters render only the capability portion in this milestone; the language dimension in the display is Milestone 5.

**Tech Stack:** TypeScript (strict, ESM, `.js` import specifiers), Vitest, Biome, tsup. No new dependencies.

## Global Constraints

- **No new runtime dependencies** — the `veriskit` CLI keeps its existing two.
- **ESM import specifiers end in `.js`** even for `.ts` sources (e.g. `import ... from "./model.js"`).
- **`veriskit`/`VerisKit` naming** — user-facing strings say VerisKit; the package/CLI is `veriskit`.
- **Byte-identical scope:** "byte-identical" in this plan means **terminal output and process exit codes** are unchanged for JS-only repos. On-disk evidence check ids intentionally gain a `:js` suffix (documented change); tests that assert on those strings are updated as part of the relevant task.
- **Composite key format:** `key = `${capabilityId}:${language}``, e.g. `unit:js`. Filesystem artifacts (log files) replace `:` with `-` for cross-platform safety.
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure

- `src/core/model.ts` — add `Language`, `language` fields, `key` field, migrate `checkId`/`Verdict` string types, add `checkKey`/`splitKey` helpers. (Owns the type contract.)
- `src/config/detect.ts` — tag every detected capability `language: "js"`.
- `src/runners/base.ts` — `runViaExec` writes `CheckResult.checkId = check.key`; add `checkKey` usage.
- `src/runners/*.ts` (7 adapters) — each `toCheck` sets `language` + `key` from the capability.
- `src/core/verdict.ts` — match results to capabilities by composite key; `verifiedCapabilities`/`skipped` become composite strings.
- `src/core/orchestrator.ts` + `src/core/orchestrate.ts` + `src/cli/commands/watch.ts` — build synthetic `CheckResult.checkId` values as composite keys; iterate over capabilities forward-compatibly.
- `src/evidence/store.ts` — sanitize `:` → `-` in log filenames.
- `src/reporters/terminal.ts` + `src/reporters/markdown.ts` — display the capability portion of the composite key (byte-identical for `:js`).
- Test files alongside each.

---

## Task 1: `Language` type and key helpers

**Files:**
- Modify: `src/core/model.ts`
- Test: `src/core/model.test.ts` (create)

**Interfaces:**
- Produces:
  - `type Language = "js" | "python" | "go"`
  - `function checkKey(id: CapabilityId, language: Language): string` → `"${id}:${language}"`
  - `function splitKey(key: string): { id: string; language: string }`

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

At the top, alongside the existing type aliases, add:

```ts
export type Language = "js" | "python" | "go"; // "js" covers TypeScript
```

At the bottom of the file, add:

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
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/model.ts src/core/model.test.ts
git commit -m "feat(model): add Language type and checkKey/splitKey helpers"
```

---

## Task 2: Reshape the model types and every producer (atomic)

A type reshape must land atomically to compile. Steps edit each producer in order; the suite is run at the end of the task. Do not commit between steps — commit once at the end when the build and full suite are green.

**Files:**
- Modify: `src/core/model.ts`
- Modify: `src/config/detect.ts`
- Modify: `src/runners/base.ts`
- Modify: `src/runners/tsc.ts`, `vitest.ts`, `jest.ts`, `node-test.ts`, `eslint.ts`, `biome.ts`, `playwright.ts`
- Modify tests: `src/runners/tsc.test.ts`, `src/runners/vitest.test.ts`, `src/runners/lint.test.ts`, `src/runners/playwright.test.ts`

**Interfaces:**
- Consumes: `Language`, `checkKey` from Task 1.
- Produces:
  - `Capability` gains required `language: Language`.
  - `Check` gains required `language: Language` and `key: string`.
  - `CheckResult.checkId` type becomes `string`.
  - `Verdict.verifiedCapabilities` and `Verdict.skipped` become `string[]`.

- [ ] **Step 1: Widen the type contract in `src/core/model.ts`**

```ts
export interface Capability {
  id: CapabilityId;
  language: Language; // NEW
  available: boolean;
  runner?: string;
  reason?: string;
}

export interface Check {
  id: CapabilityId;
  language: Language; // NEW
  key: string;        // NEW — checkKey(id, language)
  title: string;
  runner: string;
  cmd: string;
  args: string[];
}

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

And in `Verdict`:

```ts
export interface Verdict {
  state: VerdictState;
  verifiedCapabilities: string[]; // composite keys
  skipped: string[];              // composite keys
  reasons: string[];
}
```

- [ ] **Step 2: Tag detected capabilities with `language: "js"` in `src/config/detect.ts`**

Every returned `Capability` literal must include `language: "js"`. Update all four detector helpers. Examples:

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

Apply the same `language: "js"` addition to every `Capability` returned by `detectUnit`, `detectLint`, and `detectBrowser` (both available and unavailable branches).

- [ ] **Step 3: Populate `language` + `key` in each runner's `toCheck`**

Each adapter builds its `Check` literal. Add `language: cap.language` and `key: checkKey(cap.id, cap.language)`, and import `checkKey`. For `src/runners/vitest.ts`:

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

Apply the identical `language: cap.language` + `key: checkKey(<id>, cap.language)` addition (and the `checkKey` import) to `tsc.ts` (id `"types"`), `jest.ts` (`"unit"`), `node-test.ts` (`"unit"`), `eslint.ts` (`"lint"`), `biome.ts` (`"lint"`), and `playwright.ts` (`"browser"`). In `playwright.ts`, also change the synthetic result literal on the browser path from `checkId: "browser"` to `checkId: check.key`.

- [ ] **Step 4: Emit the composite key from `runViaExec` in `src/runners/base.ts`**

Change the two places that reference `check.id`:

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

- [ ] **Step 5: Update runner tests to include the new fields**

The runner tests construct `Capability`/`Project` literals. Add `language: "js"` to each `Capability` literal and assert the new `key`. For `src/runners/tsc.test.ts`:

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

Apply the same `language: "js"` addition to the `Capability` literals in `vitest.test.ts`, `lint.test.ts`, and `playwright.test.ts` (drop any now-unneeded `as Capability` cast where the literal is now complete). If any of those tests assert `checkId`/`check.id` on a produced result, update the expectation to the composite key (e.g. `unit:js`, `lint:js`, `browser:js`).

- [ ] **Step 6: Run the full suite**

Run: `npm run verify` (or `npx vitest run` + `npx tsc --noEmit`)
Expected: TypeScript compiles; the only remaining failures are in `verdict.test.ts`, `orchestrator`/`orchestrate` tests, evidence tests, and reporter tests — fixed in Tasks 3–6. If any *runner* or *detect* test fails, fix it here before moving on.

> Note: because this is an atomic type change, downstream test files (verdict, orchestrator, evidence, reporters) may not compile until their tasks land. If the worker's toolchain blocks committing on a red suite, proceed through Tasks 3–6 and commit at the end of Task 6; otherwise commit the compiling subset now:

- [ ] **Step 7: Commit**

```bash
git add src/core/model.ts src/config/detect.ts src/runners
git commit -m "refactor(model): add language + composite key to Capability/Check/CheckResult/Verdict"
```

---

## Task 3: Verdict matches by composite key

**Files:**
- Modify: `src/core/verdict.ts`
- Modify: `src/core/verdict.test.ts`

**Interfaces:**
- Consumes: `checkKey` from Task 1; `Capability.language` from Task 2.
- Produces: `computeVerdict` returns composite keys in `verifiedCapabilities`/`skipped`.

- [ ] **Step 1: Update the failing tests first**

In `src/core/verdict.test.ts`, the `caps` fixtures need `language` and the results/assertions need composite keys:

```ts
const caps: Capability[] = [
  { id: "types", language: "js", available: true, runner: "tsc" },
  { id: "unit", language: "js", available: true, runner: "vitest" },
  { id: "lint", language: "js", available: false, reason: "no linter configured" },
];
```

Update each `res("types", ...)` call to `res("types:js", ...)`, `res("unit", ...)` to `res("unit:js", ...)`, etc. Update assertions from `toContain("lint")` to `toContain("lint:js")`, `not.toContain("lint")` to `not.toContain("lint:js")`, and the `browser` case caps literal to include `language: "js"` with `toContain("browser:js")`. The unregistered-runner case's synthetic result `checkId: "lint"` becomes `checkId: "lint:js"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/verdict.test.ts`
Expected: FAIL — verdict still pushes bare `cap.id`, so composite-key assertions don't match.

- [ ] **Step 3: Match by composite key in `src/core/verdict.ts`**

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

`verdictExitCode` is unchanged. The `reasons` strings still use the bare `cap.id` to keep human-facing text stable (byte-identical for JS).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/verdict.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/verdict.ts src/core/verdict.test.ts
git commit -m "refactor(verdict): key results by composite capability:language"
```

---

## Task 4: Orchestrators and watch emit composite keys

**Files:**
- Modify: `src/core/orchestrator.ts`
- Modify: `src/core/orchestrate.ts`
- Modify: `src/cli/commands/watch.ts`
- Modify tests: `src/core/orchestrator.test.ts`, `src/core/orchestrate.test.ts` (update any `checkId`/`skipped` expectations to composite keys)

**Interfaces:**
- Consumes: `checkKey` from Task 1; reshaped `Capability` from Task 2.
- Produces: every synthetic `CheckResult.checkId` (skipped/unavailable/not-affected) is a composite key; the orchestrator iterates over capabilities so multiple languages per id are supported later.

- [ ] **Step 1: Update the failing orchestrator tests**

In `src/core/orchestrator.test.ts` and `src/core/orchestrate.test.ts`, update any assertion that expects a bare `checkId` (e.g. `"unit"`, `"lint"`) or a bare entry in `verdict.skipped` to the composite form (`"unit:js"`, `"lint:js"`). Update any `Capability`/`Project` fixture literals to include `language: "js"`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/core/orchestrator.test.ts src/core/orchestrate.test.ts`
Expected: FAIL on composite-key expectations.

- [ ] **Step 3: Emit composite keys and iterate over capabilities in `src/core/orchestrator.ts`**

Replace the task-building block so it iterates over every capability whose id is requested (forward-compatible with multiple languages), and stamps composite `checkId` on the skipped path:

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

- [ ] **Step 4: Stamp the composite key on the "not affected" path in `src/core/orchestrate.ts`**

Import `checkKey` and update the synthetic result loop:

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

- [ ] **Step 5: Stamp the composite key on the synthetic skip in `src/cli/commands/watch.ts`**

At `watch.ts:32`, the synthetic `checkId: cap.id` becomes `checkId: checkKey(cap.id, cap.language)` (import `checkKey` from `../../core/model.js`). The `freshById`/cache maps at lines 17 and 92 already key on `r.checkId`, so they carry composite keys through unchanged — no further edit needed there.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/core/orchestrator.test.ts src/core/orchestrate.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/orchestrator.ts src/core/orchestrate.ts src/cli/commands/watch.ts src/core/orchestrator.test.ts src/core/orchestrate.test.ts
git commit -m "refactor(orchestrate): iterate capabilities and emit composite check keys"
```

---

## Task 5: Filesystem-safe log filenames

**Files:**
- Modify: `src/evidence/store.ts`
- Test: `src/evidence/store.test.ts` (create if absent, else extend)

**Interfaces:**
- Produces: `writeLog` and `readRunLogs` map `:` → `-` in filenames, so `unit:js` writes/reads `unit-js.log`. The in-memory map keys and `CheckResult.checkId` stay composite (`unit:js`).

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

Add a helper and use it in both `writeLog` and `readRunLogs`:

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

`digestLogs` reads from `r.logRef` directly, so it needs no change; its map key stays the composite `r.checkId`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/evidence/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/evidence/store.ts src/evidence/store.test.ts
git commit -m "fix(evidence): sanitize ':' from log filenames for composite keys"
```

---

## Task 6: Reporters render the capability portion (byte-identical) + full green

**Files:**
- Modify: `src/reporters/terminal.ts`
- Modify: `src/reporters/markdown.ts`
- Modify tests: `src/reporters/terminal.test.ts`, `src/reporters/markdown.test.ts` (only if they assert row labels)

**Interfaces:**
- Consumes: `splitKey` from Task 1.
- Produces: reporter rows display `splitKey(checkId).id` (e.g. `unit`), so JS-only output is byte-identical. The language dimension in the display is deferred to Milestone 5.

- [ ] **Step 1: Update `src/reporters/terminal.ts` to display the capability portion**

Import `splitKey` and change the row line (currently `terminal.ts:55`):

```ts
import type { CheckResult, VerificationRun } from "../core/model.js";
import { splitKey } from "../core/model.js";
```

```ts
    const label = splitKey(r.checkId).id;
    lines.push(`  ${g} ${label.padEnd(14)} ${detail}`);
```

- [ ] **Step 2: Update `src/reporters/markdown.ts` to display the capability portion**

Import `splitKey` and change the two rows that print `r.checkId` (currently `markdown.ts:52` and `markdown.ts:67`):

```ts
import { splitKey } from "../core/model.js";
```

```ts
      `| ${splitKey(r.checkId).id} | ${r.status} | ${dur} | ${cell(r.summary)} | ${log} |`,
```

```ts
      lines.push(`### ${splitKey(r.checkId).id}`);
```

- [ ] **Step 3: Verify reporter tests**

Run: `npx vitest run src/reporters`
Expected: PASS. If a snapshot or assertion referenced a bare label it stays identical (`unit`, not `unit:js`); if any test fixture built a `CheckResult` with a composite `checkId`, confirm the rendered label is the bare id.

- [ ] **Step 4: Run the FULL suite + typecheck**

Run: `npm run verify`
Expected: PASS — all tests green, `tsc --noEmit` clean, Biome clean.

- [ ] **Step 5: Dogfood — confirm terminal output is byte-identical**

Run: `node bin/veris verify` in this repo (a JS-only project).
Expected: the `Checks` block shows `types`, `lint`, `unit` exactly as before — no `:js` suffix visible — and the verdict/exit code are unchanged from `main`.

- [ ] **Step 6: Commit**

```bash
git add src/reporters
git commit -m "refactor(reporters): render capability portion of composite key (byte-identical)"
```

---

## Self-Review

**Spec coverage (Milestone 1 scope only):**
- `Language` type + `language` on Capability/Check → Tasks 1, 2 ✓
- Composite `key` on Check; `CheckResult.checkId`/`Verdict` migrated to strings → Tasks 1, 2, 3 ✓
- Orchestrator forward-compatible with multiple languages per id → Task 4 ✓
- JS behavior byte-identical (terminal + exit codes) → Tasks 3 (stable reason text), 6 (display id-part), Task 6 Step 5 dogfood ✓
- Evidence/log plumbing carries composite keys safely → Task 5 ✓
- No Python/Go detection or adapters (correctly deferred to M2–M4) ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `checkKey`/`splitKey` signatures identical across Tasks 1, 3, 4, 6. `Capability.language`, `Check.language`/`key`, `CheckResult.checkId: string`, `Verdict.*: string[]` consistent across all tasks. ✓

**Deferred to later milestones (out of scope here):** language-aware reporter display (M5), pytest/go/mypy/ruff/golangci-lint adapters (M2–M4), Python/Go detection + `resolveBin` + config schema (M2).
