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

## Project intelligence

`veris scan` and `veris plan` map your codebase's import graph and turn it
into recommendations — what to test, where verification is weak, and (with
`--base`) which of your changes are risky. Both are **read-only analysis**;
neither generates or writes any code.

### `veris scan`

```bash
veris scan
```

`scan` discovers every source and test file in the project, builds an import
graph between them, and reports the source files with the most dependents
that no test transitively reaches ("untested, by impact"). It writes the
graph to `.veris/graph.json` — a derived cache, rebuilt on every run and not
meant to be committed.

**`scan` always states which resolver built the graph**, because the two
have very different accuracy:

- **`typescript`** — used when the project has a `tsconfig.json` and its own
  `typescript` package exposes the classic compiler API
  (`preProcessFile`/`resolveModuleName`/`readConfigFile`/…). Veris loads
  *your project's own* TypeScript at run time — **no new dependency is added
  for this** — and resolves imports the way `tsc` would: `tsconfig` path
  aliases, extension-mapped specifiers, index resolution, and so on.
- **`scanner`** — the fallback when there's no TypeScript, no
  `tsconfig.json`, or the installed `typescript` package is a 7.x
  native/Go-ported build that doesn't expose the classic compiler API veris
  needs. The scanner is a dependency-free, **relative-imports-only** reader:
  it follows `./foo` and `../bar/baz` but does not understand `tsconfig`
  path aliases or dynamic/non-literal imports. On a project that relies on
  aliases, this can miss real edges and undercount a file's blast radius.
  `scan` says plainly when this fallback is active — it is never presented
  as equivalent to the TypeScript-accurate graph.

### `veris plan`

```bash
veris plan               # recommendations from the current graph
veris plan --base main   # also factor in changes vs another ref
```

`plan` reads the same graph and turns it into prioritized recommendations:

- the highest-impact untested files to test first (most dependents, no test
  reaches them);
- gaps in your verification setup (e.g. no lint or type-check configured);
- with `--base <ref>`, which files that changed since that ref are "risky" —
  high blast radius and either untested or actually changed.

**`plan` only recommends — it never generates or writes any code.** Test
generation is a separate, later goal (v0.8), not something v0.3 does.

### What's still deferred

- **No framework route/endpoint detection.** The graph understands imports
  only; it doesn't know a file is an Express route, a Next.js page, or an
  API handler, so it can't flag "this endpoint has no test" the way it flags
  "this module has no test." Planned as a v0.3.x follow-up, not v0.3.0.
- **No test generation.** `plan` recommends what to test; it does not write
  test files. That's v0.8.
- **Single tsconfig, single root.** Monorepos with multiple `tsconfig.json`
  files aren't modeled yet — resolution runs against the root project only.
- **Plain JS / TS 7.x-native projects degrade to the scanner.** There's no
  new dependency added to compensate — the classic TypeScript compiler API
  is what makes the accurate resolver possible, and projects without it get
  the honestly-labeled, relative-imports-only fallback described above.

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

The table above decides *which check categories* run — that part is still a
coarse, file-extension-based mapping. **What changed in v0.3 is what happens
inside the `unit` category.** Instead of running every unit test in the
project, `affected` builds the same import graph that
[`veris scan`/`veris plan`](#project-intelligence) use and narrows the unit
run to only the test files that **transitively import** your changed files.

That narrowing is deliberately conservative — it **falls back to running the
full test suite** rather than ever risk hiding an affected test:

- any changed file matches a config/global pattern (`tsconfig*.json`,
  `package.json`, a `*.config.*` or `*.setup.*` file, biome/eslint config, …);
- a changed file isn't resolved in the graph at all (outside the project
  root, or the resolver couldn't parse it);
- no test file transitively reaches any of the changed files (an untested
  change).

The output says when a run was narrowed and why it wasn't:

```text
unit narrowed to 3 of 41 test file(s) via typescript graph
unit ran in full — global/config change (package.json)
```

Today it will still sometimes run more than the minimal ideal set (a config
change reruns everything, an unresolved file falls back to full), but it
never silently skips work it can't prove is safe to skip.

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

Every tick after the baseline uses the same graph-based `unit` narrowing (and
conservative full-suite fallback) described above for `affected` — the graph
is rebuilt fresh each tick, so it always reflects the file you just saved,
not a stale snapshot.

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
`veris init`. `.veris/graph.json` (written by [`veris scan`](#project-intelligence))
is a separate derived cache, rebuilt on every scan — treat it the same way
and don't commit it.

## Design

Full rationale, locked decisions, and the v0.2+ roadmap live in the design
spec: [`docs/superpowers/specs/2026-07-08-veris-v0.1-design.md`](docs/superpowers/specs/2026-07-08-veris-v0.1-design.md).

## License

MIT
