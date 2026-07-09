# Changelog

## 0.2.0 — 2026-07-09

### Added
- `veris affected` — run only the checks relevant to changed files (coarse: no import graph yet). `--base <ref>` for PR/CI diffs.
- `veris watch` — re-run affected checks as files change, using native fs.watch (no new dependency) with a `--poll` fallback and cross-tick `cached` results.
- Honest scoped verdicts: affected/watch runs never report a bare "Verified"; unaffected capabilities are shown as "not affected by changes".

### Changed
- Extracted the runner base (Runner/RunContext/localBin/runViaExec) into `src/runners/base.ts` to eliminate an adapter import cycle.

## 0.1.0 — 2026-07-08

### Added
- `veris init`, `doctor`, `test`, `verify`, `report`.
- Zero-config detection: package manager, TypeScript, Vitest, Jest, node:test, ESLint, Biome, Playwright (detected, not run).
- Parallel check orchestration with a three-state verdict (verified / failed / partial).
- Local evidence store under `.veris/` and Markdown verification reports.
- CI-correct exit codes (0 verified, 1 failed, 2 partial; `--partial-ok` overrides).
