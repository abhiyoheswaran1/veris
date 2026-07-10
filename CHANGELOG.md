# Changelog

## 0.4.1 — 2026-07-10

### Added
- Signed evidence. `veris evidence keygen` creates an Ed25519 keypair (via Node's built-in crypto, no new dependency); `veris evidence sign <evidence.json>` writes a detached signature; `veris evidence verify` checks a sibling signature automatically and can assert the signer with `--pubkey` or `--key-id`. Bundles carry the signature. Signing is opt-in; unsigned evidence still verifies for integrity. `VERISKIT_SIGNING_KEY` supplies the key in CI.

### Changed
- `veris init` now gitignores `keys/`.

## 0.4.0 — 2026-07-10

### Added
- Evidence System. Every `veris verify` and `veris affected` run writes a canonical, git-anchored `.veris/runs/<id>/evidence.json` (schema `veriskit/evidence@1`) with a sha256 integrity digest over the whole record and a sha256 of each per-check log. No new runtime dependencies.
- `veris evidence verify <file>` recomputes and checks a record or a bundle, and states plainly what an integrity digest does and does not prove.
- `veris evidence bundle` packages the latest run (record, report, and logs, each digested) into one portable proof file under `.veris/evidence/`.
- `veris evidence show` prints the latest record's key facts.

### Changed
- The report and terminal output now show the git commit and whether the tree was clean, plus the evidence digest in the report.
- `evidence.json` replaces the older `metadata.json`. `veris init` now also gitignores `evidence/`.

## 0.3.0 — 2026-07-10

### Added
- `veris scan` — import-graph map + untested areas, built from the project's own TypeScript (with a dep-free scanner fallback); writes `.veris/graph.json`.
- `veris plan` — prioritized recommendations (high-impact untested files, weak verification, risky changes). Analysis only — no code generation.

### Changed
- `veris affected` / `veris watch` are now graph-based: the unit run is narrowed to only the test files that transitively import your changes, with a conservative full-suite fallback (config/global change, unresolved file, or untested change) so an affected test is never skipped. No new runtime dependencies.

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
