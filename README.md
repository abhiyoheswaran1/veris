<p align="center">
  <img src="assets/veriskit-icon.svg" alt="VerisKit" width="96" height="96">
</p>

<h1 align="center">VerisKit</h1>

<p align="center"><strong>The fastest way to prove your software works.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/veriskit"><img src="https://img.shields.io/npm/v/veriskit?color=14b8a6&label=npm" alt="npm version"></a>
  <img src="https://img.shields.io/badge/deps-cac%20%2B%20picocolors-14b8a6" alt="two runtime dependencies">
  <img src="https://img.shields.io/badge/license-MIT-14b8a6" alt="MIT license">
</p>

<p align="center">
  <img src="assets/veriskit-affected.gif" alt="veris affected narrowing the unit run to only the tests that reach a change" width="760">
</p>

<p align="center"><em>Change a file. VerisKit runs only the tests that reach it (2 of 28 here), then gives an honest verdict.</em></p>

---

VerisKit runs the test and quality tools your project already has (TypeScript, Vitest, Jest, `node:test`, ESLint, Biome), then turns their results into one honest verdict with a Markdown report you can paste into a pull request. There is no config to write and no new test framework to learn.

It answers the question a wall of green checkmarks leaves open: **is this change safe enough to trust?**

## Install

```bash
npx veriskit init
```

Or add it to a project:

```bash
npm install --save-dev veriskit
```

You install the package `veriskit`. The command it gives you is `veris`. (The bare name `veris` was already too close to another npm package.)

## Quickstart

```bash
veris init      # detect the stack, write .veris/config.json (idempotent)
veris verify    # run the configured checks, print a verdict, write a report
veris report    # print the latest report
```

Two more commands round out the basics. `veris doctor` prints a read-only capability report: what will run, what will be skipped, and why. `veris test` runs just the detected unit test runner with the same summarized output as `verify`.

## The verdict

`veris verify` runs your checks and prints one result. Here is a passing run:

```text
VerisKit

Project     veriskit
Risk        —

Checks
  ✓ types          1.2s
  ✓ unit           2.4s
  ✓ lint           0.6s

Result
  ✓ Verified

Commit      4fa33a9 · tree clean

Report
  .veris/reports/verify-2026-07-10T09-04-52-076Z-1.md
```

The verdict has three states, not two:

| Verdict | Exit code | Meaning |
|---|---|---|
| `verified` | `0` | every configured check ran and passed |
| `failed` | `1` | at least one check failed |
| `partial` | `2` (`0` with `--partial-ok`) | no failures, but a check was skipped or its result is unknown |

A partial verdict is not a pass. A check can end up skipped when its runner is not installed, or when nothing in your change reaches it. VerisKit lists that check as skipped and lowers the verdict rather than folding it into "verified", because a folded skip hands CI confidence it did not earn. If your team wants partial runs to pass CI, opt in with `veris verify --partial-ok`.

VerisKit orchestrates the tools you already run. It shells out to `tsc`, Vitest, Jest, `node:test`, ESLint, and Biome, reads their exit codes and output, and reports one result. It does not run browser tests, and it does not ship its own test engine. Detection stays read-only, and `init` never overwrites an existing `.veris/config.json`.

## Developer loop

While you work, scope the checks to what you touched instead of running everything.

### `veris affected`

```bash
veris affected              # checks affected by working-tree changes vs HEAD
veris affected --base main  # checks affected by the diff against another ref (PR/CI)
```

`affected` reads which files changed (your working tree plus untracked files against `HEAD`, or against `--base <ref>` for a PR/CI diff) and maps each one to the check categories it can touch:

| Changed file | Checks run |
|---|---|
| test file | unit, lint |
| TypeScript file | types, lint, unit |
| JavaScript file | lint, unit |
| config (`tsconfig`, biome/eslint config, `package.json`, `veris.config.*`) | every available check |
| docs and assets (`.md`, images, `LICENSE`) | nothing |
| anything else unrecognized | every available check (a safe default) |

That table picks the check categories. Inside the `unit` category, `affected` goes further: it builds the same import graph that [`veris scan` and `veris plan`](#project-intelligence) use, then runs only the test files that transitively import your changed files.

The narrowing stays conservative. It runs the full unit suite whenever it cannot prove a smaller set is safe:

- a changed file matches a config or global pattern (`tsconfig*.json`, `package.json`, a `*.config.*` or `*.setup.*` file, biome/eslint config)
- a changed file is not a node in the import graph (it sits under an ignored directory like `node_modules` or `.veris`, or it is not a recognized code extension)
- no test file reaches any changed file, so the change has no tests to run
- the graph came from the relative-imports scanner rather than TypeScript, which can miss aliased imports

The output says when a run was narrowed, and when it ran in full and why:

```text
unit narrowed to 3 of 41 test file(s) via typescript graph
unit ran in full — global/config change (package.json)
```

An `affected` run never prints a bare "Verified". The terminal and report say "Affected checks passed" (or "failed", or "Affected: partial"), and every available-but-unaffected capability is listed as skipped with the reason `not affected by changes`. Touch only a doc and VerisKit prints "Nothing affected" and exits `0`, which is a no-op and not a verified result: no checks ran.

### `veris watch`

```bash
veris watch          # re-run affected checks as files change
veris watch --poll   # use mtime polling instead of native fs.watch
```

`watch` runs a full baseline over every available check once, then re-runs only the checks affected by whatever changed since the last tick. It uses Node's built-in recursive `fs.watch`, so it adds no dependency. On a platform where recursive `fs.watch` is unavailable, or a filesystem where native events are unreliable (some containers and network mounts), pass `--poll` to diff file mtimes on an interval instead.

Each tick reprints the full board and rebuilds the graph fresh, so narrowing reflects the file you just saved. A capability the latest change did not touch keeps its last real result, marked `⟳ cached`. A cached failure stays a failure (`✗`); VerisKit never hides it just because it did not rerun this tick. Press Ctrl-C to stop, and the watcher (or poll loop) closes cleanly with exit `0`.

## Project intelligence

`veris scan` and `veris plan` map your codebase's import graph and turn it into recommendations: what to test, where verification is thin, and which of your changes carry risk. Both are read-only analysis. Neither writes or generates any code.

### `veris scan`

```bash
veris scan
```

`scan` finds every source and test file, builds the import graph between them, and lists the source files with the most dependents that no test reaches. It writes the graph to `.veris/graph.json`, a derived cache rebuilt on every run.

`scan` always names the resolver that built the graph, because the two differ in accuracy:

- **`typescript`** runs when your project has a `tsconfig.json` and a `typescript` package that exposes the classic compiler API. VerisKit loads your project's own TypeScript at run time, so it adds no dependency, and it resolves imports the way `tsc` does: `tsconfig` path aliases, extension-mapped specifiers, index resolution.
- **`scanner`** is the fallback for a project with no TypeScript, no `tsconfig.json`, or a TypeScript 7.x native build that drops the classic compiler API. The scanner reads relative imports only. It follows `./foo` and `../bar/baz` but does not resolve `tsconfig` path aliases or computed dynamic imports, so on an alias-heavy project it can miss edges. `scan` labels the resolver it used, and VerisKit never treats a scanner graph as equal to the TypeScript one. This is also why graph-based narrowing in `affected` and `watch` runs the full suite in scanner mode.

### `veris plan`

```bash
veris plan               # recommendations from the current graph
veris plan --base main   # also factor in changes vs another ref
```

`plan` reads the graph and prioritizes:

- the highest-impact untested files to cover first (the most dependents, reached by no test)
- gaps in your setup, such as a missing linter or type-check
- with `--base <ref>`, the changed files that carry risk: high blast radius, and either untested or freshly changed

`plan` recommends. It never writes or generates test code. Generation is a later goal, not something VerisKit does today.

## Evidence

Every `veris verify` and `veris affected` run leaves a canonical, git-anchored
evidence record you can check later or hand to someone else as proof.

- `.veris/runs/<run-id>/evidence.json` is the machine-readable record: schema
  `veriskit/evidence@1`, the verdict, per-check results, the environment, the
  git commit and whether the tree was clean, and a sha256 integrity digest over
  the whole record.
- `.veris/reports/verify-<run-id>.md` is the human-readable report, now showing
  the commit and the digest. Paste it into a PR.
- Raw per-check logs live under `.veris/runs/<run-id>/`, and the record carries
  a sha256 of each one.

Check a record:

```bash
veris evidence verify .veris/runs/<run-id>/evidence.json
```

This recomputes the digest and reports whether the record was edited or
corrupted since it was written. An integrity digest is not forgery-proof on its
own. To prove authorship, publish the digest separately (a CI log or PR) or sign
the record with an Ed25519 key (see Signing below).

Package a run as a single portable file (the record, its report, and its logs,
each with a digest, plus a bundle digest over everything):

```bash
veris evidence bundle          # writes .veris/evidence/<run-id>.bundle.json
veris evidence verify <bundle> # checks the record, every log, and the report
```

`veris evidence show` prints the latest record's key facts.

### Signing (optional)

An integrity digest proves a record was not edited. A signature proves a
specific key vouched for it. VerisKit signs with Ed25519 from Node's built-in
crypto, so signing adds no dependency and works offline.

```bash
veris evidence keygen                         # writes .veris/keys/veriskit-signing.key(.pub)
veris evidence sign .veris/runs/<id>/evidence.json --key .veris/keys/veriskit-signing.key
veris evidence verify .veris/runs/<id>/evidence.json --pubkey .veris/keys/veriskit-signing.key.pub
```

`sign` writes a detached `<evidence.json>.sig` next to the record. `verify`
picks it up automatically and checks it. In CI, pass the key through the
`VERISKIT_SIGNING_KEY` environment variable instead of a file.

A signature proves that whoever holds the private key signed the record. It
does not prove who that is. VerisKit prints the key fingerprint; to bind it to
a person or system, compare that fingerprint to one you already trust, or
assert it with `--pubkey` or `--key-id`. Keep the private key secret; `keygen`
writes it into `.veris/keys/`, which `veris init` gitignores.

Commit `.veris/config.json` and `.veris/.gitignore`. `veris init` keeps `runs/`,
`reports/`, `cache/`, `graph.json`, and `evidence/` out of your history.

## Provable verification

`veris attest` turns the latest `veris verify` run into a signed, portable
attestation of the exact commit — an in-toto statement wrapping the evidence
record, written to `.veris/attestations/<run-id>.att.json`:

```bash
veris attest                          # unsigned, or signed if VERISKIT_SIGNING_KEY is set
veris attest --key .veris/keys/veriskit-signing.key
```

It refuses to run on a dirty tree or with no prior `veris verify`, so an
attestation always names a real, reviewable commit. Sign it with
`VERISKIT_SIGNING_KEY` (CI) or `--key <path>` (local); unsigned attestations
are written too but a policy can require a signer.

`veris gate` checks that a valid attestation proves the current commit meets
`.veris/policy.json` — integrity, freshness against HEAD, verdict, and
required capabilities×languages, plus a trusted signer whenever
`require.signers` is set in policy — and exits 0 or 1, so it drops straight
into a CI job:

```bash
veris gate
```

`veris init` writes a starter `.veris/policy.json`:

```json
{
  "require": { "verdict": "verified" },
  "freshness": "head"
}
```

Commit both `.veris/policy.json` and `.veris/attestations/` — the policy is
the contract, and attestations are the shareable proof that a commit met it.
`veris init` gitignores VerisKit's other tool output (`runs/`, `reports/`,
`cache/`, `evidence/`, `keys/`) so an untracked run never makes `gate`'s
freshness check see a false "dirty" tree. Signing today is Ed25519 with a key
you hold; keyless signing via Sigstore is planned.

### Trust model: what `gate` does and does not prove

Be deliberate about what policy you ship. The starter policy above has no
`require.signers`, which makes it **integrity-only**: `gate` proves the
attestation was not edited after it was written and that it matches the
current commit on a clean tree, but it does **not** prove who produced it.
Anyone who can write a file into `.veris/attestations/` — a compromised CI
step, a local script, a careless `cp` — can hand-craft an attestation that
passes an unsigned policy.

To get a real trust gate, both sides have to hold up their end:

- **Policy** must set `require.signers` to the trusted key id(s) that are
  allowed to vouch for a passing run (`"*"` accepts any valid signature but
  still checks one exists).
- **Producer** must actually sign, via `VERISKIT_SIGNING_KEY` (CI) or
  `--key <path>` (local) at `veris attest` time.

Only when both are true does `gate` establish authorship, not just
integrity. A signer check never runs on its own — it only fires when
`require.signers` is present in policy (or `--pubkey`/`--key-id` is passed to
`gate`), so an unsigned attestation against the starter policy still passes.

Strict per-language gating also needs an explicit policy: listing
`languages` alongside `capabilities` in `require` checks each
capability×language pair individually. A bare `capabilities` entry with no
`languages` matches that capability in *any* language the project has.

## What VerisKit does not do yet

VerisKit says what it cannot do as plainly as what it can:

- **No framework route or endpoint detection.** The graph understands imports, not that a file is an Express route or a Next.js page, so it flags an untested module but not an untested endpoint. Planned next.
- **No test generation.** `plan` tells you what to test. Writing the tests is a later release.
- **One project root.** A monorepo with several `tsconfig.json` files is not modeled yet. Resolution runs against the root project.
- **Scanner fallback on plain-JS or TS 7.x-native projects.** The accurate resolver needs the classic TypeScript compiler API. Without it you get the labeled, relative-imports-only graph described above, and no dependency is added to paper over the gap.
- **No keyless or identity-bound signing.** Evidence can be signed with a local Ed25519 key (see Signing), but sigstore-style keyless signing that ties a signature to an identity is not built yet.

## Publish to a pull request

In CI, surface the verdict where reviewers look. Opt in with `--github`; VerisKit
reads `GITHUB_TOKEN` from the environment and never stores it.

```bash
veris verify --github   # posts/updates a sticky PR comment + a Check Run
```

It edits one comment on re-runs (no spam) and creates a Check Run whose
conclusion follows the verdict (verified passes, failed fails, partial is
neutral). Publishing is a side channel: if there is no token or PR, VerisKit
prints a notice and the exit code still reflects the verdict, and a GitHub API
error is reported but never changes the result.

The workflow needs permission to write them:

```yaml
permissions:
  contents: read
  pull-requests: write
  checks: write
```

For a README badge, write a shields.io endpoint file:

```bash
veris badge   # writes .veris/badge.json
```

```markdown
![VerisKit](https://img.shields.io/endpoint?url=<raw-url-to>/.veris/badge.json)
```

## Use with AI agents (MCP)

VerisKit ships an MCP server, `veriskit-mcp`, so an agent can verify a change
and read evidence as tool calls. It exposes seven tools: `veris_doctor`,
`veris_scan`, `veris_plan`, `veris_log`, and `veris_evidence_verify` (read-only),
plus `veris_verify` and `veris_affected`, which run the project's test tooling.

The `veriskit` CLI keeps its two runtime dependencies; the MCP server is a
separate package that uses the official MCP SDK. Point your MCP client at it:

```json
{
  "mcpServers": {
    "veriskit": { "command": "npx", "args": ["-y", "veriskit-mcp"] }
  }
}
```

Every tool returns the honest three-state verdict; `veris_verify` and
`veris_affected` execute your test runners and write evidence under `.veris/`.

## Browser tests

VerisKit can run your Playwright suite as part of the verdict. It is opt-in, so
a normal `veris verify` stays fast:

```bash
veris verify --browser   # also runs `playwright test`, folded into the verdict
```

When Playwright is detected, `veris doctor` lists `browser` as available. You can
also add `browser` to the `checks` array in `.veris/config.json` to run it every
time.

## History

Every run leaves an evidence record, so VerisKit can show you a trend:

```bash
veris log            # past runs, newest first
veris log --flaky    # checks that both passed and failed across recent runs
```

History is local to your machine (the `.veris/runs` directory is gitignored).

## Part of Baseframe Labs

VerisKit is one of four developer tools from [Baseframe Labs](https://www.baseframelabs.com), each answering a different question about your work:

- **[ProjScan](https://www.baseframelabs.com/apps/projscan)** asks: is the repository healthy?
- **[AgentLoopKit](https://www.baseframelabs.com/apps/agentloopkit)** asks: what should the agent do next?
- **[AgentFlight](https://www.baseframelabs.com/apps/agentflight)** asks: what did the agent actually do?
- **VerisKit** asks: can we trust the result?

Each works on its own. VerisKit needs none of the others to verify a change.

## Design

The design specs, locked decisions, and roadmap live in [`docs/superpowers/specs`](docs/superpowers/specs).

## License

MIT
