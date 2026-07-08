# veris

The fastest way to prove your software works.

Veris is a zero-config verification CLI. It detects the tools already in your
project — TypeScript, Vitest, Jest, `node:test`, ESLint, Biome — runs them,
and turns the results into one honest verdict with a reviewable Markdown
report. No config to write, no new test framework to learn.

## Install

```bash
npx veris init
```

Or add it to a project:

```bash
npm install --save-dev veris
```

## Quickstart

```bash
veris init      # detect the stack, write .veris/config.json (idempotent)
veris verify    # run the configured checks, print a verdict, write a report
veris report    # print the latest report
```

`veris doctor` and `veris test` are also available: `doctor` is a read-only
capability report (what will run, what will be skipped, and why); `test` runs
just the detected unit test runner with the same summarized output as
`verify`.

## Sample output

```text
Veris

Project     veris
Risk        —

Checks
  ✓ types          1.2s
  ✓ unit           2.4s
  ✓ lint           0.6s

Result
  ✓ Verified

Report
  .veris/reports/verify-2026-07-08T22-41-03-000Z-1.md
```

`Risk` is shown as `—` in v0.1 — risk scoring is not built yet; the column
exists so the layout is stable across future versions and never fakes a
number.

## What v0.1 does — and does not do

Veris v0.1 is an **orchestrator**, not a test engine. It shells out to
tools you already have installed and turns their exit codes and output into
one verdict:

- **Orchestrates:** `tsc` (types), Vitest, Jest, and `node:test` (unit
  tests), and ESLint or Biome (lint) — whichever your project already has
  configured. Playwright is *detected* and reported as available; it is not
  run.
- **Does not** run browser tests, and does not build or ship a native test
  execution engine. Those are explicit non-goals for v0.1 (see the design
  spec linked below).
- **Does not** impose a linter, a test runner, or any new config format —
  detection is read-only and `init` never overwrites an existing
  `.veris/config.json`.

### The verdict is three states, not two

- **`verified`** — every configured capability ran and passed.
- **`failed`** — at least one check failed. Exit code `1`.
- **`partial`** — no failures, but at least one configured capability was
  skipped or its result is unknown (e.g. a runner wasn't installed). Exit
  code `2` by default.

**`partial` is not a pass.** Veris never folds a skipped check into
"verified" — that would manufacture confidence CI shouldn't have. Teams that
want partial results to pass CI can opt in explicitly with
`veris verify --partial-ok` (exits `0` on partial).

| Verdict  | Exit code | Meaning                                   |
|----------|-----------|--------------------------------------------|
| verified | `0`       | every configured check passed              |
| failed   | `1`       | at least one check failed                  |
| partial  | `2` (`0` with `--partial-ok`) | no failures, but something was skipped |

## Evidence

Every `veris verify` run writes:

- A Markdown report under `.veris/reports/verify-<run-id>.md` — project and
  environment metadata, per-check status/timing/summary, the verdict with
  its skipped list and reasons, and log references. Paste it straight into a
  PR.
- Raw per-check logs and run metadata under `.veris/runs/<run-id>/`.

`.veris/config.json` and `.veris/.gitignore` are meant to be committed;
`.veris/runs/`, `.veris/reports/`, and `.veris/cache/` are gitignored by
`veris init`.

## Design

Full rationale, locked decisions, and the v0.2+ roadmap live in the design
spec: [`docs/superpowers/specs/2026-07-08-veris-v0.1-design.md`](docs/superpowers/specs/2026-07-08-veris-v0.1-design.md).

## License

MIT
