# veris

The fastest way to prove your software works.

Veris is a zero-config verification CLI. It detects the tools already in your
project — TypeScript, Vitest, Jest, `node:test`, ESLint, Biome — runs them,
and turns the results into one honest verdict with a reviewable Markdown
report. No config to write, no new test framework to learn.

## Install

```bash
npx veriskit init
```

Or add it to a project:

```bash
npm install --save-dev veriskit
```

> Published on npm as **`veriskit`** (the bare name `veris` was too similar to an
> existing package). The installed command is still **`veris`**.

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

## Developer loop

For fast local iteration, veris can scope checks to what you changed instead
of always running the full set.

### `veris affected`

```bash
veris affected              # checks affected by working-tree changes vs HEAD
veris affected --base main  # checks affected by the diff against another ref (PR/CI)
```

`affected` looks at which files changed — working tree + untracked files
against `HEAD`, or against `--base <ref>` for PR/CI diffs — and maps each
changed file to the check categories it plausibly touches:

| Changed file        | Checks run                    |
|----------------------|-------------------------------|
| test file             | unit, lint                    |
| TypeScript file        | types, lint, unit             |
| JavaScript file        | lint, unit                    |
| config (tsconfig, biome/eslint config, `package.json`, `veris.config.*`) | every available check |
| docs/assets (`.md`, images, `LICENSE`) | nothing |
| anything else unrecognized | every available check (safe default) |

This is **coarse — there is no import graph yet**. `affected` maps changed
*files* to check *categories*, not to the specific modules or tests that
actually import them; a real dependency-aware "run exactly the tests this
file affects" is planned for v0.3. Today it will sometimes run more than the
minimal ideal set (a config change reruns everything), but it never silently
skips work it can't prove is safe to skip.

**The verdict is honestly scoped.** An `affected` run never prints a bare
"Verified" — the terminal output and report say "Affected checks passed" (or
"Affected checks failed" / "Affected: partial") instead, and any
available-but-unaffected capability is listed as `skipped — not affected by
changes` rather than being folded into the pass. If nothing is affected (for
example you only touched a doc file), veris prints "Nothing affected" and
exits `0` — but that is explicitly **not** a verified result: no checks ran
at all.

### `veris watch`

```bash
veris watch          # re-run affected checks as files change
veris watch --poll    # use mtime polling instead of native fs.watch
```

`watch` runs a full baseline over every available check once, then watches
the working tree and re-runs only the checks affected by whatever changed
since the last tick — using Node's built-in `fs.watch` (recursive). **No new
dependency was added for this.** On platforms where recursive `fs.watch`
isn't supported, or on filesystems (containers, some network mounts) where
native change events are unreliable, pass `--poll` to fall back to an
interval-based scan that diffs file mtimes instead.

Each tick reprints the full check board. A capability that wasn't affected by
the latest change keeps showing its last real result, marked `⟳ cached` — a
cached **failure stays a failure** (✗); it is never hidden or silently
dropped just because it didn't rerun this tick. Press Ctrl-C to stop; veris
closes the watcher (or poll loop) cleanly and exits `0`.

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
