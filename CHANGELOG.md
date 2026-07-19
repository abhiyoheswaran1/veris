# Changelog

## Unreleased

### Added
- Provable verification. `veris attest` packages the latest `veris verify` into a portable, Ed25519-signed in-toto attestation of the exact commit; `veris gate` blocks unless a valid attestation meets `.veris/policy.json` (integrity, trusted signer, freshness against HEAD, verdict, and required capabilities×languages). No new dependencies. Keyless/Sigstore signing is planned.
- Polyglot verification. `veris` now detects Python (`pyproject.toml`/`setup.py`/`setup.cfg`/`requirements.txt`) and Go (`go.mod`) alongside JavaScript/TypeScript, runs each language's own tools — pytest, mypy/pyright, ruff/flake8/pylint for Python; `go test`, `go build`, golangci-lint/`go vet` for Go — and merges everything into one verdict and one evidence record. Tool choice is presence-first with a preference order, overridable in `.veris/config.json` (`languages` to enable/disable a language, `tools` to force a specific tool per capability). `doctor` shows the language of each capability, and the verification report qualifies each check with its language when a run spans more than one. JavaScript-only projects are unaffected.

## 0.6.1 — 2026-07-17

### Changed
- Evidence check ids are now namespaced by language (for example `unit:js` instead of `unit`), and per-check log files are renamed to match (`unit-js.log`). This is the groundwork for polyglot verification — running each language's own test tools under one verdict. Terminal output and exit codes are unchanged.

## 0.6.0 — 2026-07-14

### Added
- `veriskit-mcp`, a Model Context Protocol server exposing VerisKit over stdio with seven tools (doctor, scan, plan, log, evidence_verify, verify, affected), publishable to the MCP registry. The `veriskit` CLI keeps its two runtime dependencies; the MCP SDK lives only in `veriskit-mcp`.
- `veriskit` now has a programmatic API (`verifyProject`, `affectedProject`, and the core detect/graph/history/evidence functions), so it can be used as a library.

## 0.5.1 — 2026-07-13

### Changed
- `--github` publish errors now include GitHub's own message (for example "Resource not accessible by integration" when the workflow token lacks `pull-requests: write` or `checks: write`), so a failed publish is diagnosable. The token still never appears in any error.
- `homepage` now points to the VerisKit product page.

## 0.5.0 — 2026-07-13

### Added
- Publish to GitHub. `veris verify --github` posts and updates one sticky PR comment with the verdict and report, and creates a Check Run (verified passes, failed fails, partial is neutral). Token read from `GITHUB_TOKEN`; publishing never changes the verdict or exit code. `veris badge` writes a shields.io endpoint JSON. GitHub API over built-in fetch, no new dependency.
- Browser tests. A real Playwright runner, opt-in with `veris verify --browser` (or a `browser` entry in `.veris/config.json`). Detected Playwright now shows as an available capability.
- `veris log` lists past runs from the stored evidence records, and `veris log --flaky` flags checks that both passed and failed across recent runs. Local per-machine history.

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
