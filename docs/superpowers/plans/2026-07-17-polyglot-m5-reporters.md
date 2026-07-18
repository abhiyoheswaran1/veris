# Polyglot Verification — Milestone 5: Language-Aware Reporters + Fixture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the terminal and Markdown verification reports a language dimension — each check row is qualified with its language **only when a run spans more than one language**, so JS-only output stays byte-identical while polyglot runs disambiguate `unit (python)` from `unit (go)`. Add a polyglot fixture + end-to-end test, and draft the `0.7.0` changelog under an **Unreleased** heading (no version bump — nothing ships).

**Architecture:** M1 made `CheckResult.checkId` a composite `capability:language` key that reporters already collapse to the bare capability via `splitKey`. This milestone adds a tiny display helper (`runSpansLanguages`, `checkLabel`) and wires both reporters through it: single-language runs render `unit` (unchanged); multi-language runs render `unit (python)`. Evidence already spans all languages (composite ids since M1) — no evidence change needed. A polyglot fixture (`package.json` + `pyproject.toml` + `go.mod`) plus an end-to-end test proves detection → registry handshake across all three languages.

**Tech Stack:** TypeScript (strict, ESM, `.js` specifiers), Vitest, Biome. No new dependencies.

## Global Constraints

- **No new runtime dependencies.**
- **ESM import specifiers end in `.js`.**
- **`veriskit`/`VerisKit` naming.**
- **JS-only output stays byte-identical:** when a run involves a single language, terminal and Markdown check rows render exactly as they do today (`unit`, `types`, `lint` — no language suffix, same padding). The language qualifier appears ONLY when `run.results` span >1 distinct language.
- **NO version bump / NO release.** `package.json` version stays `0.6.1`. The changelog entry goes under a `## Unreleased` heading (the release workflow triggers only on a `package.json` version change and extracts notes by version heading, so `Unreleased` publishes nothing).
- **Every task ends green:** `npm run verify` passes before each commit.
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure

- `src/reporters/label.ts` — NEW: `runSpansLanguages(results)` + `checkLabel(checkId, showLanguage)`.
- `src/reporters/terminal.ts` — render `checkLabel` with the run's language-span flag.
- `src/reporters/markdown.ts` — same, for the Check table + failure headings.
- `test/fixtures/polyglot/` — NEW: `package.json` + `pyproject.toml` + `go.mod`.
- `src/config/detect.test.ts` — end-to-end polyglot detection + registry-handshake test.
- `CHANGELOG.md` — `## Unreleased` entry (no version bump).
- Test files alongside.

---

## Task 1: Display helper + terminal reporter

**Files:**
- Create: `src/reporters/label.ts`
- Create: `src/reporters/label.test.ts`
- Modify: `src/reporters/terminal.ts`
- Modify: `src/reporters/terminal.test.ts`

**Interfaces:**
- Consumes: `splitKey`, `CheckResult` from `../core/model.js`.
- Produces:
  - `runSpansLanguages(results: CheckResult[]): boolean` — true iff the results contain >1 distinct language (via `splitKey(checkId).language`).
  - `checkLabel(checkId: string, showLanguage: boolean): string` — `splitKey(checkId).id` when `showLanguage` is false; `` `${id} (${language})` `` when true.

- [ ] **Step 1: Write the failing test for the helper**

Create `src/reporters/label.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CheckResult } from "../core/model.js";
import { checkLabel, runSpansLanguages } from "./label.js";

const r = (checkId: string): CheckResult => ({
  checkId,
  status: "passed",
  durationMs: 1,
  summary: "",
});

describe("runSpansLanguages", () => {
  it("is false for a single-language run", () => {
    expect(runSpansLanguages([r("unit:js"), r("types:js")])).toBe(false);
  });
  it("is true when more than one language is present", () => {
    expect(runSpansLanguages([r("unit:js"), r("unit:python")])).toBe(true);
  });
});

describe("checkLabel", () => {
  it("returns the bare capability id when not showing language", () => {
    expect(checkLabel("unit:js", false)).toBe("unit");
  });
  it("qualifies with the language when showing language", () => {
    expect(checkLabel("unit:python", true)).toBe("unit (python)");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/reporters/label.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/reporters/label.ts`**

```ts
import { type CheckResult, splitKey } from "../core/model.js";

// True when the results span more than one language, so a per-row language
// qualifier is worth showing. A single-language run stays unqualified.
export function runSpansLanguages(results: CheckResult[]): boolean {
  const langs = new Set(results.map((r) => splitKey(r.checkId).language));
  return langs.size > 1;
}

// Display label for a check row: the bare capability id ("unit") for a
// single-language run, or the language-qualified form ("unit (python)") when
// the run spans multiple languages.
export function checkLabel(checkId: string, showLanguage: boolean): string {
  const { id, language } = splitKey(checkId);
  return showLanguage ? `${id} (${language})` : id;
}
```

- [ ] **Step 4: Run to verify the helper passes**

Run: `npx vitest run src/reporters/label.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing terminal test**

Add to `src/reporters/terminal.test.ts` (a polyglot run shows the language; keep existing single-language tests, which assert `unit`/`types`/`lint` and must still pass unchanged):

```ts
import { runSpansLanguages } from "./label.js";

describe("renderRun — polyglot", () => {
  it("qualifies rows with the language when the run spans languages", () => {
    const polyRun = {
      id: "p",
      startedAt: "2026-07-17T00:00:00.000Z",
      project: {
        root: "/x",
        packageManager: "npm",
        frameworks: [],
        languages: ["javascript", "python"],
        scripts: {},
        capabilities: [],
      },
      results: [
        { checkId: "unit:js", status: "passed", durationMs: 100, summary: "" },
        {
          checkId: "unit:python",
          status: "passed",
          durationMs: 100,
          summary: "",
        },
      ],
      verdict: {
        state: "verified",
        verifiedCapabilities: ["unit:js", "unit:python"],
        skipped: [],
        reasons: [],
      },
      env: {
        os: "linux",
        node: "v24",
        pm: "npm",
        ci: false,
        timestamp: "2026-07-17T00:00:00.000Z",
      },
    } as unknown as import("../core/model.js").VerificationRun;
    const out = renderRun(polyRun);
    expect(out).toContain("unit (js)");
    expect(out).toContain("unit (python)");
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/reporters/terminal.test.ts`
Expected: FAIL — current output shows `unit` for both rows (no language qualifier).

- [ ] **Step 7: Wire the helper into `src/reporters/terminal.ts`**

Replace the `splitKey` import and the row-render logic. Change the import line:

```ts
import type { CheckResult, VerificationRun } from "../core/model.js";
import { checkLabel, runSpansLanguages } from "./label.js";
```

(Remove the now-unused `splitKey` import from this file.) Then, just before the `for (const r of run.results)` loop, compute the flag, and use `checkLabel` for the row label with language-aware padding:

```ts
  lines.push("Checks");
  const showLang = runSpansLanguages(run.results);
  for (const r of run.results) {
    const g = glyph(r.status, plain); // always reflect the real status — cached failures stay ✗
    const detail =
      r.status === "skipped"
        ? dim(`skipped — ${r.summary}`)
        : r.cached
          ? dim(`⟳ cached · ${secs(r.durationMs) || "—"}`)
          : secs(r.durationMs);
    const label = checkLabel(r.checkId, showLang);
    lines.push(`  ${g} ${label.padEnd(showLang ? 16 : 14)} ${detail}`);
    if (r.outputTail) {
      for (const tail of r.outputTail.split("\n")) {
        lines.push(dim(`    ${tail}`));
      }
    }
  }
```

(The `padEnd(14)` for the single-language path is unchanged, keeping JS-only output byte-identical; the wider pad applies only to multi-language runs.)

- [ ] **Step 8: Run tests, then full suite**

Run: `npx vitest run src/reporters && npm run verify`
Expected: PASS — existing single-language terminal tests still assert `unit`/`types`/`lint` (byte-identical), the new polyglot test passes.

- [ ] **Step 9: Dogfood — JS-only output unchanged**

Run: `node bin/veris verify` in this repo (JS-only).
Expected: `Checks` rows read exactly `types`, `lint`, `unit` (no `(js)` suffix), verdict and exit code unchanged.

- [ ] **Step 10: Commit**

```bash
git add src/reporters/label.ts src/reporters/label.test.ts src/reporters/terminal.ts src/reporters/terminal.test.ts
git commit -m "feat(reporters): qualify terminal rows with language on multi-language runs"
```

---

## Task 2: Markdown reporter

**Files:**
- Modify: `src/reporters/markdown.ts`
- Modify: `src/reporters/markdown.test.ts`

**Interfaces:**
- Consumes: `checkLabel`, `runSpansLanguages` from `./label.js`.

- [ ] **Step 1: Write the failing test**

Add to `src/reporters/markdown.test.ts` (a polyglot run qualifies the Check column; keep existing single-language tests unchanged):

```ts
describe("renderMarkdown — polyglot", () => {
  it("qualifies the Check column with the language across languages", () => {
    const polyRun = {
      id: "p",
      startedAt: "2026-07-17T00:00:00.000Z",
      project: {
        root: "/x",
        packageManager: "npm",
        frameworks: [],
        languages: ["javascript", "go"],
        scripts: {},
        capabilities: [],
      },
      results: [
        { checkId: "unit:js", status: "passed", durationMs: 100, summary: "" },
        { checkId: "unit:go", status: "failed", durationMs: 100, summary: "", outputTail: "FAIL x_test.go" },
      ],
      verdict: {
        state: "failed",
        verifiedCapabilities: ["unit:js"],
        skipped: [],
        reasons: [],
      },
      env: {
        os: "linux",
        node: "v24",
        pm: "npm",
        ci: false,
        timestamp: "2026-07-17T00:00:00.000Z",
      },
    } as unknown as import("../core/model.js").VerificationRun;
    const out = renderMarkdown(polyRun);
    expect(out).toContain("unit (js)");
    expect(out).toContain("unit (go)");
    // failure heading also qualified
    expect(out).toContain("### unit (go)");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/reporters/markdown.test.ts`
Expected: FAIL — both rows currently render `unit`.

- [ ] **Step 3: Wire the helper into `src/reporters/markdown.ts`**

Change the import:

```ts
import { relative } from "node:path";
import type { VerificationRun } from "../core/model.js";
import { checkLabel, runSpansLanguages } from "./label.js";
import type { EvidenceRecord } from "../evidence/record.js";
```

(Remove the now-unused `splitKey` import.) Compute the flag once inside `renderMarkdown` (e.g. right after `const lines: string[] = [];`):

```ts
  const showLang = runSpansLanguages(run.results);
```

Use it in the Check table row:

```ts
    lines.push(
      `| ${checkLabel(r.checkId, showLang)} | ${r.status} | ${dur} | ${cell(r.summary)} | ${log} |`,
    );
```

And in the failure heading:

```ts
      lines.push(`### ${checkLabel(r.checkId, showLang)}`);
```

- [ ] **Step 4: Run tests, then full suite**

Run: `npx vitest run src/reporters/markdown.test.ts && npm run verify`
Expected: PASS — existing single-language markdown tests still assert bare ids (byte-identical); the polyglot test passes.

- [ ] **Step 5: Commit**

```bash
git add src/reporters/markdown.ts src/reporters/markdown.test.ts
git commit -m "feat(reporters): qualify markdown check names with language on multi-language runs"
```

---

## Task 3: Polyglot fixture + end-to-end test + changelog

**Files:**
- Create: `test/fixtures/polyglot/package.json`
- Create: `test/fixtures/polyglot/pyproject.toml`
- Create: `test/fixtures/polyglot/go.mod`
- Modify: `src/config/detect.test.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `detectProject` from `./detect.js`; `runners` from `../runners/index.js`.

- [ ] **Step 1: Create the polyglot fixture**

`test/fixtures/polyglot/package.json`:

```json
{
  "name": "polyglot-fixture",
  "version": "0.0.0",
  "devDependencies": { "vitest": "^4.0.0" }
}
```

`test/fixtures/polyglot/pyproject.toml`:

```toml
[project]
name = "polyglot-fixture"
version = "0.0.0"
```

`test/fixtures/polyglot/go.mod`:

```
module polyglot-fixture

go 1.22
```

- [ ] **Step 2: Write the failing end-to-end test**

Add to `src/config/detect.test.ts`:

```ts
import { fileURLToPath } from "node:url";
import { runners } from "../runners/index.js";

const fxPath = (n: string) =>
  fileURLToPath(new URL(`../../test/fixtures/${n}`, import.meta.url));

describe("detectProject — polyglot fixture end to end", () => {
  it("detects all three languages and every emitted runner name is registered", async () => {
    const project = await detectProject(fxPath("polyglot"));

    // all three languages present
    for (const lang of ["javascript", "python", "go"]) {
      expect(project.languages).toContain(lang);
    }
    // capabilities exist for python and go (availability depends on the host,
    // so we assert presence, not availability)
    expect(project.capabilities.some((c) => c.language === "python")).toBe(true);
    expect(project.capabilities.some((c) => c.language === "go")).toBe(true);

    // detection ↔ registry handshake: every runner name a capability names is
    // a registered runner (no "no runner registered" surprises).
    for (const c of project.capabilities) {
      if (c.runner) expect(runners[c.runner]).toBeDefined();
    }
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run src/config/detect.test.ts`
Expected: PASS. (If it fails on a runner name not being registered, that is a real detection↔registry mismatch — fix the registry/detector so they agree; do NOT weaken the assertion.)

> Note: this test asserts every runner NAME emitted for the fixture resolves to a registered runner. Config-override runner names (`tools.*`) are not exercised by this fixture, so they are out of scope here.

- [ ] **Step 4: Add the changelog entry under `## Unreleased` (no version bump)**

In `CHANGELOG.md`, insert directly under the top `# Changelog` heading, above `## 0.6.1`:

```markdown
## Unreleased

### Added
- Polyglot verification. `veris` now detects Python (`pyproject.toml`/`setup.py`/`setup.cfg`/`requirements.txt`) and Go (`go.mod`) alongside JavaScript/TypeScript, runs each language's own tools — pytest, mypy/pyright, ruff/flake8/pylint for Python; `go test`, `go build`, golangci-lint/`go vet` for Go — and merges everything into one verdict and one evidence record. Tool choice is presence-first with a preference order, overridable in `.veris/config.json` (`languages` to enable/disable a language, `tools` to force a specific tool per capability). `doctor` shows the language of each capability, and the verification report qualifies each check with its language when a run spans more than one. JavaScript-only projects are unaffected.
```

Do NOT change `package.json`'s version. Leave it at `0.6.1`.

- [ ] **Step 5: Full suite + final polyglot-aware dogfood**

Run: `npm run verify`
Expected: PASS.

Then confirm the JS-only dogfood is still clean:

Run: `node bin/veris verify`
Expected: `types`/`lint`/`unit` with no language suffix (single-language run), verdict and exit code unchanged.

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/polyglot src/config/detect.test.ts CHANGELOG.md
git commit -m "test+docs: polyglot fixture end-to-end test + Unreleased changelog for v0.7"
```

---

## Self-Review

**Spec coverage (M5 — spec §2 reporters, §8 milestone 5):**
- Terminal + Markdown gain the language dimension → Tasks 1, 2 ✓
- JS-only output byte-identical (qualifier only when >1 language) → `runSpansLanguages` gate + Task 1 Step 9 / Task 3 Step 5 dogfood ✓
- One evidence record spans all languages → already true since M1 (composite ids); no change needed ✓
- Polyglot fixture + end-to-end detection↔registry test → Task 3 ✓
- Changelog for the feature, staged for the 0.7.0 cut → Task 3 Step 4 under `## Unreleased`, no version bump ✓
- NO release (version stays 0.6.1) → constraint honored throughout ✓

**Placeholder scan:** none; every step has complete code/content. ✓

**Type consistency:** `runSpansLanguages`/`checkLabel` signatures fixed in Task 1 and consumed identically by both reporters; `splitKey` remains the single source of id/language parsing. ✓

**Known-refine (non-blocking):** default Python/Go tool args (`pylint .`, `go vet ./...`, etc.) remain the M3/M4 known-refine; a real polyglot repo dogfood (beyond the marker-only fixture) is the natural place to tune them before cutting 0.7.0.

**After M5:** the full v0.7 polyglot feature is complete and green on `polyglot-v0.7`, unreleased. Cutting `0.7.0` later = rename `## Unreleased` → `## 0.7.0 — <date>` + bump `package.json` to `0.7.0` + merge to main (the push triggers the npm publish). That is a deliberate, separate step for another day.
