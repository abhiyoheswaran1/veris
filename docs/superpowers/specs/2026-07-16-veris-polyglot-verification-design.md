# Veris v0.7 — Polyglot Verification — Design Spec

**Date:** 2026-07-16
**Status:** Approved (brainstorm) — ready for implementation plan
**Scope:** v0.7 "Polyglot Verification" only. A DSL and any native engine are explicitly out.

---

## 1. Thesis

Veris runs each project's real test tools and reports one honest verdict with portable
evidence. v0.7 makes that **polyglot**: a single `veris verify` detects JavaScript/TypeScript,
Python, and Go in one repository, runs each language's own mature engine, and merges the
results into **one verdict** and **one** `evidence.json`.

This *widens* the founding thesis — "orchestrate mature engines, never build one" — it does
not violate it. Every test still executes on vitest / jest / node:test / pytest / `go test`.
Veris adds detection, dispatch, and honest merging. It never executes tests itself.

### Strategic-constraint check (non-negotiable)

The locked "no native test engine — not in v0.1, not at v1.0" decision is untouched. The
tempting alternative — a Veris-native test *format/DSL* that compiles to each language — was
considered and **rejected** in brainstorming precisely because it drifts toward the engine the
thesis forbids. Users keep writing native tests in each language's normal way.

---

## 2. Scope

### In (v0.7)

- Detect JS/TS, Python, and Go, independently, in a single repo (any 1–3 present).
- Run three capabilities **per detected language**:
  - `unit` — vitest/jest/node:test (existing) · pytest · `go test ./...`
  - `types` — tsc (existing) · mypy › pyright · `go build ./...` (compile check)
  - `lint` — eslint/biome (existing) · ruff › flake8 › pylint · golangci-lint › `go vet`
- Merge all checks into one verdict and **one** git-anchored `evidence.json` spanning every
  language.
- Terminal and Markdown reporters gain a language dimension.
- `.veris/config.json` gains per-language enable/disable and per-(capability) tool overrides.

### Out (deferred — do NOT build in v0.7)

- **DSL / any new test-authoring format.** Rejected as thesis-adjacent to a native engine.
- **Native test engine.** Unchanged from the v0.1 constraint.
- **Polyglot import-graph `affected`.** The TypeScript import graph stays JS-only. For Python
  and Go, if a changed file belongs to that language, Veris runs that language's **full** suite
  (conservative — an affected test is never silently skipped). A cross-language graph is a
  later spec.
- **Risk scoring** (still displayed as `—`).
- **Languages beyond JS/Python/Go.**
- **`python -m unittest`** and other non-primary runners — pytest-only for Python unit in this
  spec; alternates are later adapters.

---

## 3. Data model (the core structural change)

Today `Check.id` **is** a `CapabilityId`, so there is exactly one check per capability — that
is the structural wall. v0.7 keys everything by **(capability × language)**.

```ts
export type Language = "js" | "python" | "go"; // "js" covers TypeScript

export interface Capability {
  id: CapabilityId;   // types | lint | unit | browser
  language: Language; // NEW — a capability now exists per (id × language)
  available: boolean;
  runner?: string;
  reason?: string;
}

export interface Check {
  id: CapabilityId;
  language: Language; // NEW
  key: string;        // NEW — `${id}:${language}`, e.g. "unit:python"
  title: string;      // e.g. "Unit tests (Python)"
  runner: string;
  cmd: string;
  args: string[];
}

// CheckResult.checkId becomes the composite `key` string ("unit:python").
// Evidence logs are already keyed by checkId, so composite keys flow through unchanged.
// Verdict.verifiedCapabilities / skipped become composite `key[]`.
```

### Decision: flatten, don't nest

One `Capability`/`Check` per **(capability × language)** pair. This preserves the existing
Check↔Capability 1:1 relationship, so the orchestrator, evidence store, and reporters barely
change — they iterate over more, differently-keyed items. The nested alternative
(`Capability` with an inner `perLanguage[]`) is more faithful to "a capability" as one thing,
but forces every consumer to learn a two-level shape for no functional gain. Flatten.

`browser` remains JS-only in practice (Playwright), but carries a `language: "js"` for
uniformity; nothing special-cases it.

---

## 4. Detection

Each language is detected independently; a repo may trigger any subset.

| Language | Detected by |
|---|---|
| JS/TS   | `package.json` (existing) |
| Python  | `pyproject.toml` \| `setup.py` \| `setup.cfg` \| `requirements.txt` |
| Go      | `go.mod` |

`Project.languages` (already present) is populated from these. Detection never fails hard on a
missing language — an absent language simply contributes no checks.

### Tool-choice policy

Selection is **presence-first** (only pick a tool that is actually installed), then a fixed
preference order, then a config override wins over both.

| Capability | JS (existing) | Python | Go |
|---|---|---|---|
| `unit`  | vitest / jest / node:test | **pytest** | **`go test ./...`** |
| `types` | tsc | **mypy › pyright** | **`go build ./...`** |
| `lint`  | eslint / biome | **ruff › flake8 › pylint** | **golangci-lint › `go vet`** |

Note on Go `types`: `go test` already compiles, so `go build ./...` is mildly redundant. It is
kept as a distinct capability so a compile break is reported as `types` rather than buried in
`unit`, and so the per-language matrix stays uniform.

### Binary resolution

Generalize the existing `localBin(root, name)` into a per-language `resolveBin(root, language, name)`:

- **JS** → `node_modules/.bin/<name>` (unchanged behavior)
- **Python** → `.venv/bin/<name>`, then `venv/bin/<name>`, then `PATH`
- **Go** → `PATH`

If a language is detected but no tool exists for a capability, that check is emitted as
`skipped` with a loud reason (see §5) — never silently dropped, never a hard error.

### Config

`.veris/config.json` gains:

```jsonc
{
  "languages": { "python": true, "go": false }, // enable/disable a detected language
  "tools": { "python": { "lint": "flake8" } }   // force a specific tool for a capability
}
```

- A language set to `false` is omitted entirely from the run (opt-out; does not dent the
  verdict — see §5).
- A forced tool that is not installed produces a `skipped` check with a clear reason, rather
  than silently falling back.

---

## 5. Verdict & honesty merge rules

Not overclaiming is the core of Veris. Merge across all (capability × language) checks:

- **Any** check `failed` → verdict **`failed`**.
- All present checks `passed`, but **any** `skipped` → verdict **`partial`**, with each skip
  surfaced loudly.
- All relevant checks `passed`, nothing skipped → verdict **`verified`**.

Honesty specifics:

- Language detected but its runner absent → that check is **`skipped`**
  (e.g. "Python detected; pytest not installed") → verdict drops to **`partial`**. Never a bare
  "Verified."
- Language detected but zero test files for a capability → `skipped` with that reason (not a
  pass).
- Language **disabled** in config → omitted entirely, not skipped. The user opted out, so it
  does not dent the verdict.
- `affected`/`watch` runs → unaffected languages/capabilities show as **"not affected by
  changes"** (reusing the 0.2 scoped-verdict language), so a narrow run never reports a bare
  "Verified" either.

### Terminal output contract

Flat rows keyed by capability × language:

```
unit   · ts      ✓ (12)
unit   · python  ✓ (30)
unit   · go      ✗ (1 failed)
types  · ts      ✓
lint   · python  — skipped (ruff not installed)
→ Verdict: FAILED
```

Markdown report and `evidence.json` use the same composite keys.

---

## 6. Runner adapters

Each new adapter follows the existing `runViaExec` shape (see `src/runners/vitest.ts` — ~25
lines): a `toCheck` that builds the `Check` (now with `language` and `key`) and a `run` that
delegates to `runViaExec` with pass/fail summaries and a timeout. No new runtime dependency —
all tools are shelled out to via the central `exec`, array-arg spawn, resolved through
`resolveBin`.

New adapters: `pytest`, `mypy` (or `pyright`), `ruff` (or `flake8`/`pylint`), `go test`,
`go build`, `golangci-lint` (or `go vet`). Adapters are lazy-loaded per active
(capability × language), preserving the cold-start budget.

---

## 7. Testing

Mirrors existing patterns (`vitest.test.ts`, `lint.test.ts`, fixture repos).

- A **polyglot fixture repo** (js + py + go in one tree), plus single-language fixtures.
- Per-adapter tests, one per new runner, following the current adapter-test shape.
- **Verdict-merge unit tests** — highest value: pass/fail/skip combinations across languages
  producing the correct merged verdict.
- Detection tests for Python/Go marker files and tool-preference ordering.
- `npm run verify` green in CI. **CI change:** the Veris pipeline now needs Python and Go
  toolchains installed to exercise the polyglot fixture end-to-end.

---

## 8. Milestones

Each is independently shippable and dogfoodable (per the AgentLoopKit / AgentFlight harness
convention: gate at milestone boundaries).

1. **Model reshape** — add `Language`, composite `key`; flatten
   `Capability`/`Check`/`CheckResult`/`Verdict`. JS behavior byte-identical; all existing tests
   green (pure refactor).
2. **Detection + `resolveBin`** — Python/Go language detection, tool-choice policy, config
   schema; `doctor` reports the polyglot matrix.
3. **Python adapters** — pytest, mypy/pyright, ruff/flake8/pylint; merged verdict across js+py.
4. **Go adapters** — `go test`, `go build`, golangci-lint/`go vet`.
5. **Reporters + evidence** — terminal + Markdown gain the language dimension; one evidence
   record spans all languages; polyglot-fixture dogfood → cut v0.7.

---

## 9. Release checklist (v0.7)

- [ ] All 5 milestones merged, each with passing `npm run verify`.
- [ ] Existing single-language (JS) behavior unchanged — no regression in current tests/output.
- [ ] Polyglot fixture produces one verdict + one `evidence.json` spanning all three languages.
- [ ] Honesty rules verified: missing runner → skipped → partial, never bare "Verified".
- [ ] CI provisions Python + Go toolchains; pipeline green.
- [ ] CHANGELOG `0.7.0` entry; README documents polyglot detection and config.
- [ ] Dogfooded on ≥1 real polyglot repo; report artifact reviewed.
