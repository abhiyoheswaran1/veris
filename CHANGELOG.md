# Changelog

## 0.1.0 — 2026-07-08

### Added
- `veris init`, `doctor`, `test`, `verify`, `report`.
- Zero-config detection: package manager, TypeScript, Vitest, Jest, node:test, ESLint, Biome, Playwright (detected, not run).
- Parallel check orchestration with a three-state verdict (verified / failed / partial).
- Local evidence store under `.veris/` and Markdown verification reports.
- CI-correct exit codes (0 verified, 1 failed, 2 partial; `--partial-ok` overrides).
