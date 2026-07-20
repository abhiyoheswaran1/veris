# attest/gate v1.1 — library API + MCP tools + dirty-guard consistency — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** (1) Make `attest`'s dirty guard consistent with `gate` (shared `.veris/attestations/` exemption) and refuse stale evidence; (2) extract clean `attestProject`/`gateProject` library functions in `veriskit` and expose them; (3) add `attest`/`gate` handlers to `veriskit-mcp` and bump its `veriskit` dependency. Ships as `veriskit 0.7.2`; the `veriskit-mcp` publish is deferred to a maintainer infra step (OIDC).

**Architecture:** `veriskit` already exposes `verifyProject`/`affectedProject` as the programmatic core the CLI and MCP both wrap. This plan gives `attest`/`gate` the same shape: `attestProject(root, opts)` / `gateProject(root, opts)` return structured results; the existing CLI commands (`runAttest`/`runGate`) become thin wrappers over them (printing + exit codes), and the MCP handlers wrap them for `json(...)`. A shared `anchorIgnoringAttestations` helper (extracted from gate's reviewed `currentAnchor`) makes the dirty check identical in both commands.

**Tech Stack:** TypeScript (strict, ESM, `.js`), Vitest, Biome; MCP SDK + zod in the `veriskit-mcp` workspace. No new `veriskit` runtime deps.

## Global Constraints
- No new `veriskit` runtime dependencies; ESM `.js` specifiers; TS strict; `veriskit`/`VerisKit` naming.
- Behavior-preserving for existing CLI users except the two intended fixes (attest dirty exemption + stale-evidence guard).
- Every task ends green: `npm run verify` passes before each commit.
- The `veriskit-mcp` publish is OUT of scope here — land the code + version/dep bumps; do NOT trigger the mcp publish.
- TDD, DRY, YAGNI, frequent commits.

## File Structure
- `src/git/changes.ts` — add `anchorIgnoringAttestations(root)`.
- `src/cli/commands/gate.ts` — use the shared helper (remove local `currentAnchor`).
- `src/evidence/attestation-project.ts` — NEW: `attestProject(root, opts)`.
- `src/policy/gate-project.ts` — NEW: `gateProject(root, opts)`.
- `src/cli/commands/attest.ts` / `gate.ts` — thin wrappers over the `*Project` fns.
- `src/index.ts` — export `attestProject`, `gateProject` (+ attestation/policy types).
- `mcp/src/tools.ts` / `server.ts` — `attestHandler`/`gateHandler` + registration.
- `mcp/package.json` — `veriskit` dep → `^0.7.2`, version → `0.7.0`.
- Test files alongside.

---

## Task 1: Shared attestations-exempt anchor + attest dirty/stale guards

**Files:**
- Modify: `src/git/changes.ts`, `src/cli/commands/gate.ts`, `src/cli/commands/attest.ts`
- Test: `src/git/changes.test.ts` (or a focused test), `src/cli/commands/attest.test.ts`

**Interfaces:**
- Produces: `anchorIgnoringAttestations(root: string): Promise<GitAnchor | null>` — `gitAnchor`, but `dirty=false` when every changed path is under `.veris/attestations/`.

- [ ] **Step 1: Write failing tests** — (a) `anchorIgnoringAttestations` returns `dirty:false` when only a `.veris/attestations/x.att.json` is untracked but `dirty:true` when a source file changed; (b) `runAttest` SUCCEEDS when a prior untracked attestation exists but the source tree matches HEAD; (c) `runAttest` REFUSES when the evidence commit ≠ current HEAD (stale evidence), with a clear message.

```ts
// changes.test.ts
import { anchorIgnoringAttestations } from "./changes.js";
// build a real git repo, commit, add .veris/attestations/x.att.json untracked → dirty:false;
// modify a tracked source file → dirty:true.
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/git/changes.test.ts src/cli/commands/attest.test.ts` → FAIL.

- [ ] **Step 3: Add the shared helper to `src/git/changes.ts`**

```ts
// Like gitAnchor, but changes confined entirely to `.veris/attestations/`
// (VerisKit's own shareable, deliberately-not-gitignored output) do NOT count
// as dirty — so a freshly-written attestation doesn't make the tree look dirty
// to attest/gate. Source and tracked `.veris/policy.json`/`config.json` still
// trip dirty.
export async function anchorIgnoringAttestations(
  root: string,
): Promise<GitAnchor | null> {
  const anchor = await gitAnchor(root);
  if (!anchor?.dirty) return anchor;
  const cs = await changedFiles(root);
  const meaningful = cs.files.filter(
    (f) => !f.startsWith(".veris/attestations/"),
  );
  if (meaningful.length > 0) return anchor;
  return { ...anchor, dirty: false, changedFiles: 0 };
}
```

- [ ] **Step 4: Use it in `src/cli/commands/gate.ts`** — delete the local `currentAnchor` function and its now-unused imports (`changedFiles`, and `GitAnchor` if unused); import `anchorIgnoringAttestations` and call it where `currentAnchor(root)` was called. (Gate behavior is unchanged — same logic, now shared.)

- [ ] **Step 5: Fix attest's guards in `src/cli/commands/attest.ts`** — after the `!record.git` no-repo guard, replace the `record.git.dirty` refusal with a live, attestations-exempt check AND a stale-evidence check:

```ts
  const anchor = await anchorIgnoringAttestations(root);
  if (!anchor) {
    process.stderr.write("veris: cannot attest outside a git repository.\n");
    return 1;
  }
  if (anchor.dirty) {
    process.stderr.write(
      "veris: cannot attest a dirty tree — commit or stash first.\n",
    );
    return 1;
  }
  if (record.git.commit !== anchor.commit) {
    process.stderr.write(
      `veris: evidence is for ${record.git.commit.slice(0, 7)} but HEAD is ${anchor.commit.slice(0, 7)} — re-run \`veris verify\`.\n`,
    );
    return 1;
  }
```

(Import `anchorIgnoringAttestations` from `../../git/changes.js`. The attestation subject/predicate still come from `record.git.commit`, which now provably equals HEAD.)

- [ ] **Step 6:** `npm run verify` green; dogfood `node bin/veris verify >/dev/null && node bin/veris attest && node bin/veris attest` (second attest, with the first now untracked, must still succeed). Commit.

```bash
git commit -m "fix(attest): share .veris/attestations dirty-exemption with gate; refuse stale evidence"
```

---

## Task 2: `attestProject` library function

**Files:**
- Create: `src/evidence/attestation-project.ts`
- Modify: `src/cli/commands/attest.ts`, `src/index.ts`
- Test: `src/evidence/attestation-project.test.ts`

**Interfaces:**
- Produces: `attestProject(root: string, opts?: { key?: string }): Promise<AttestOutcome>` where
  `AttestOutcome = { ok: boolean; error?: string; path?: string; subjectCommit?: string; verdict?: VerdictState; signerKeyId?: string; attestation?: Attestation }`.
  It performs the read-latest-evidence + guards (no-run/no-repo/dirty/stale from Task 1) + build + sign + write, returning a structured result instead of printing. Signing key: `opts.key` PEM path, else `VERISKIT_SIGNING_KEY`.

- [ ] **Step 1: Write failing test** — `attestProject` on a repo with clean matching evidence returns `{ ok:true, path, subjectCommit, verdict, signerKeyId? }`; on a dirty tree returns `{ ok:false, error: /dirty/ }`; on no run returns `{ ok:false, error: /no verification run/ }`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `attestProject`** — move the core of `runAttest` here (readLatestRecord, the Task-1 guards, key resolution, buildAttestation/signAttestation, writeAttestation), returning `AttestOutcome` (never printing, never `process.exit`). Reuse `anchorIgnoringAttestations`.

- [ ] **Step 4: Refactor `runAttest` (CLI) to wrap it** — call `attestProject(root, { key: opts.key })`, then print the same human output on `ok` (path / subject / signer lines) or the `error` to stderr, and return `0`/`1`. Preserve `--out` (pass through, or write in the CLI after getting the attestation). Existing `attest.test.ts` must still pass (adjust only if the CLI output is intentionally identical).

- [ ] **Step 5: Export from `src/index.ts`** — add `attestProject` and re-export `Attestation`/`Statement` types.

- [ ] **Step 6:** `npm run verify` green; commit.

```bash
git commit -m "feat(evidence): attestProject library API; runAttest wraps it"
```

---

## Task 3: `gateProject` library function

**Files:**
- Create: `src/policy/gate-project.ts`
- Modify: `src/cli/commands/gate.ts`, `src/index.ts`
- Test: `src/policy/gate-project.test.ts`

**Interfaces:**
- Produces: `gateProject(root: string, opts?: { policy?: string; attestation?: string; pubKeyId?: string }): Promise<GateOutcome>` where
  `GateOutcome = { ok: boolean; error?: string; result?: GateResult; attestationPath?: string }`.
  It loads policy (via `loadPolicy`/`loadPolicyFile`, fail-closed on malformed), the attestation (latest or `--attestation`), the current `anchorIgnoringAttestations`, then `evaluatePolicy`, returning the structured `GateResult` (never printing/exiting). `error` for no-attestation / malformed policy / malformed attestation.

- [ ] **Step 1: Write failing test** — `gateProject` passes on a clean matching signed/verified attestation; `ok:false` + error on no attestation; `result.passed === false` on a stale commit.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `gateProject`** — move the core of `runGate` here (policy load with try/catch, attestation load, `anchorIgnoringAttestations`, evaluatePolicy) → `GateOutcome`. `pubKeyId` is passed through to `evaluatePolicy`'s trust.

- [ ] **Step 4: Refactor `runGate` (CLI) to wrap it** — resolve `pubKeyId` from `--pubkey`/`--key-id`, call `gateProject`, print the check report + `Gate: passed/FAILED`, return `0`/`1`. Existing `gate.test.ts` must still pass.

- [ ] **Step 5: Export from `src/index.ts`** — add `gateProject`, `Policy`, `GateResult`.

- [ ] **Step 6:** `npm run verify` green; dogfood verify→attest→gate = passed; commit.

```bash
git commit -m "feat(policy): gateProject library API; runGate wraps it"
```

---

## Task 4: MCP `attest`/`gate` tools + dep/version bump

**Files:**
- Modify: `mcp/src/tools.ts`, `mcp/src/server.ts`, `mcp/package.json`
- Test: `mcp/src/tools.test.ts`

**Interfaces:**
- Consumes: `attestProject`, `gateProject` from `veriskit`.
- Produces: `attestHandler(input: { path?: string })` and `gateHandler(input: { path?: string; policy?: string; attestation?: string })` returning `ToolResult` via `json(...)`/`fail(...)`; registered as MCP tools `attest` and `gate`.

- [ ] **Step 1: Write failing test** — in `mcp/src/tools.test.ts`, build a tiny git repo with a verify run, then `attestHandler({ path })` returns `{ ok, path, subjectCommit, verdict }`; `gateHandler({ path })` returns `{ passed, checks }`. (Follow the existing `verifyHandler` test setup.)

- [ ] **Step 2: Run to verify failure** — `npm run -w veriskit-mcp test` (or the repo's mcp test command) → FAIL.

- [ ] **Step 3: Add handlers in `mcp/src/tools.ts`** — import `attestProject`, `gateProject` from `veriskit`; mirror the `verifyHandler` shape:

```ts
export async function attestHandler(input: { path?: string }): Promise<ToolResult> {
  const outcome = await attestProject(root(input));
  if (!outcome.ok) return fail(outcome.error ?? "attest failed");
  return json({
    path: outcome.path,
    subjectCommit: outcome.subjectCommit,
    verdict: outcome.verdict,
    signer: outcome.signerKeyId ?? null,
  });
}

export async function gateHandler(input: {
  path?: string;
  policy?: string;
  attestation?: string;
}): Promise<ToolResult> {
  const outcome = await gateProject(root(input), {
    policy: input.policy,
    attestation: input.attestation,
  });
  if (!outcome.ok || !outcome.result) return fail(outcome.error ?? "gate failed");
  return json({ passed: outcome.result.passed, checks: outcome.result.checks });
}
```

- [ ] **Step 4: Register in `mcp/src/server.ts`** — two `server.registerTool` calls mirroring the existing ones, with zod `inputSchema` (`path` optional; gate adds optional `policy`/`attestation`), and honest one-line descriptions ("Sign the latest verification into a portable attestation."; "Check the latest attestation against .veris/policy.json — pass/fail with reasons."). Update the server version string if it hardcodes one.

- [ ] **Step 5: Bump `mcp/package.json`** — `dependencies.veriskit` → `^0.7.2`; `version` → `0.7.0` (new tools = minor). (Do NOT publish — that's a separate maintainer/OIDC step.)

- [ ] **Step 6:** `npm run verify` (root) + the mcp tests green; commit.

```bash
git commit -m "feat(mcp): attest + gate tools; depend on veriskit ^0.7.2"
```

---

## Task 5: Docs + changelog (veriskit 0.7.2)

**Files:** `README.md` (note attest/gate are also MCP tools + the stale-evidence guard), `CHANGELOG.md` (`## Unreleased` → will become 0.7.2 at release).

- [ ] **Step 1:** Add a `## Unreleased` `### Added`/`### Fixed` block: attest/gate available as MCP tools + programmatic `attestProject`/`gateProject`; attest now refuses stale evidence and no longer trips on a prior untracked attestation. Do NOT bump `package.json` (the release step does that). `npm run verify` green; commit.

```bash
git commit -m "docs: attest/gate v1.1 — library API, MCP tools, stale-evidence guard"
```

---

## Self-Review
- Dirty-guard consistency (shared exemption) + stale-evidence guard → Task 1 ✓
- `attestProject`/`gateProject` library API + CLI wrappers + exports → Tasks 2, 3 ✓
- MCP attest/gate tools + dep/version bump (code only; publish deferred) → Task 4 ✓
- Docs/changelog, no premature version bump → Task 5 ✓
- No new veriskit deps; behavior preserved except the two intended fixes ✓
- **Explicitly deferred:** the `veriskit-mcp` npm publish (OIDC/infra) and keyless/Sigstore signing (own brainstorm).
