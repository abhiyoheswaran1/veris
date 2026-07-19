# Veris `attest` + `gate` — Verifiable Verification — Design Spec

**Date:** 2026-07-19
**Status:** Approved (brainstorm) — ready for implementation plan
**Scope:** v1 "internal merge/deploy gate" only. Keyless/public-release signing and agent ergonomics are explicitly v2+.

---

## 1. Thesis

A green checkmark is a *claim*. VerisKit already produces a canonical, git-anchored `evidence.json` with an integrity digest and optional Ed25519 signature. This feature turns that into a **portable, signed verification attestation** and adds a **policy gate** so a claim becomes a *proof*: `veris gate` passes only when a valid attestation proves *this exact commit* was honestly verified to a declared policy — not a stale commit, not a dirty tree, not a `partial` hiding a skipped check.

This stays fully inside the VerisKit thesis: no native engine, **no new runtime dependencies** (Node built-in crypto + JSON only), CI-agnostic, local-first. It builds directly on the existing `evidence/record.ts` and `evidence/signing.ts`.

### Why it's differentiated

Nobody owns "honest, portable, provable *verification*." GitHub artifact attestations prove *build* provenance, are GitHub-locked, and say nothing about whether tests honestly passed. VerisKit attesting to the *verification verdict* — polyglot, honest about `partial`, CI-agnostic — is an open, valuable lane, and the sharpest wedge is the internal gate.

---

## 2. Scope

### In (v1)

- `veris attest` — wrap the latest verification run's evidence as a standard **in-toto Statement**, sign it with the existing Ed25519 signing, and write `.veris/attestations/<id>.att.json`. Refuses to attest a non-repo or a **dirty** tree.
- `veris gate` — evaluate an attestation against `.veris/policy.json` and exit non-zero if unmet (usable as a CI/merge/deploy gate). Checks signature+signer, freshness (subject commit == current HEAD, clean tree), verdict, and required capabilities × languages.
- `.veris/policy.json` schema + loader with a sensible default.
- An attestation file format that is a real in-toto Statement (interop-ready), signed with VerisKit's existing signature scheme.

### Out (deferred — do NOT build in v1)

- **Keyless / Sigstore (Fulcio + Rekor transparency log)** and full **DSSE PAE** cosign-verifiable signatures. v1 emits the in-toto Statement structure and signs it with VerisKit's scheme; a DSSE-PAE envelope for cosign interop is a v2 item.
- **Public release attestation** for downstream consumers (a `verify-attestation <pkg>` flow) — v2, reuses this core with a public trust root.
- **Agent ergonomics** (`--json` streaming verdict, `explain`) — separate track.
- **Attestation transparency log / storage service**, cloud, auth, billing.
- Policy features beyond §6 (coverage %, time windows, multiple attestations, org-role signers).

---

## 3. Attestation format

A VerisKit attestation is an in-toto Statement (real, standard structure) plus an optional VerisKit signature. Signing is opt-in, mirroring the existing evidence-signing philosophy (unsigned still has integrity via the embedded evidence digest).

```ts
export const ATTESTATION_SCHEMA = "veriskit/attestation@1";
export const PREDICATE_TYPE = "https://veriskit.dev/attestations/verification/v1";
export const STATEMENT_TYPE = "https://in-toto.io/Statement/v1";

export interface Statement {
  _type: string;                 // STATEMENT_TYPE
  subject: Array<{ name: string; digest: { gitCommit: string } }>;
  predicateType: string;         // PREDICATE_TYPE
  predicate: EvidenceRecord;     // the existing record, verbatim
}

export interface Attestation {
  schema: string;                // ATTESTATION_SCHEMA
  statement: Statement;
  signature: Signature | null;   // existing evidence/signing.ts Signature, or null
}
```

- **subject** — the git commit being attested: `name` = the project name (`EvidenceRecord.project.name`), `digest.gitCommit` = `EvidenceRecord.git.commit`. (`gitCommit` is a recognized in-toto digest algorithm name.)
- **predicate** — the `EvidenceRecord` verbatim (already canonical + self-digested), so the attestation carries the full honest verdict, per-`capability:language` checks, tool version, and git anchor.
- **signature** — reuses `Signature` from `evidence/signing.ts`, over `sha256(canonicalize(statement))` (the same canonicalization used for evidence). `null` when unsigned.

`attestationDigest(statement)` = `sha256(canonicalize(statement))` — the value that is signed and re-checked on verify.

---

## 4. `veris attest`

```
veris attest [--key <path>] [--out <path>]
```

Behavior:
1. Locate the latest run's evidence via `latestRunDir(root)` → read `evidence.json` into an `EvidenceRecord`. If none, error: "no verification run found — run `veris verify` first."
2. **Honesty guards (fail, non-zero):**
   - `record.git === null` → "cannot attest outside a git repository."
   - `record.git.dirty === true` → "cannot attest a dirty tree — commit or stash first." (An attestation must correspond to an identifiable, reproducible commit.)
3. Build the `Statement` (subject from `record.git.commit` + `record.project.name`, predicate = record).
4. **Sign** if a key is available: `--key <pem>` file, else `VERISKIT_SIGNING_KEY` env (PEM). If neither, produce an **unsigned** attestation and print a note ("unsigned — set VERISKIT_SIGNING_KEY or pass --key to sign"). Signing reuses `signDigest(attestationDigest(statement), privateKeyPem)`.
5. Write to `--out` or `.veris/attestations/<record.id>.att.json` (pretty JSON + trailing newline, consistent with `writeEvidence`). Print the path, the subject commit, the verdict, and the signer keyId (or "unsigned").

Exit codes: `0` on success (signed or unsigned), non-zero on the honesty guards / no-run / write error.

`attest` never changes a verdict; it only packages and signs an existing one.

---

## 5. `veris gate`

```
veris gate [--policy <path>] [--attestation <path>] [--pubkey <path>] [--key-id <id>]
```

Behavior:
1. Load the policy: `--policy`, else `.veris/policy.json`, else `DEFAULT_POLICY` (§6).
2. Load the attestation: `--attestation`, else the latest `*.att.json` in `.veris/attestations/`. If none, **fail**: "no attestation found — run `veris attest`."
3. Compute the current git state via `gitAnchor(root)`.
4. Evaluate the policy (§7). Print a per-check report (each requirement with ✓/✗ and a reason). Print an overall `Gate: passed` / `Gate: FAILED — <first failing reason>`.

Exit codes: `0` gate passed; `1` gate failed (any unmet requirement, invalid/missing signature when required, stale/dirty, verdict/coverage shortfall, or no attestation/policy resolvable). A single non-zero is deliberate — a branch-protection/deploy step only cares pass/fail.

`gate` is read-only and never runs checks; it evaluates an existing attestation.

---

## 6. Policy schema

`.veris/policy.json`:

```jsonc
{
  "require": {
    "verdict": "verified",              // "verified" (default) | "partial-ok"
    "capabilities": ["types", "unit"],  // capability ids that must be verified…
    "languages": ["js"],                // …in each of these languages (cross-product)
    "signers": ["*"]                    // allowed key-ids; "*" = any valid signature;
                                        //   omitted/empty = signature not required
  },
  "freshness": "head"                    // "head" (default) | "off"
}
```

```ts
export interface Policy {
  require?: {
    verdict?: "verified" | "partial-ok";
    capabilities?: string[];
    languages?: string[];
    signers?: string[];
  };
  freshness?: "head" | "off";
}

export const DEFAULT_POLICY: Policy = {
  require: { verdict: "verified" },
  freshness: "head",
};
```

Semantics:
- **verdict** — default `verified`: the attestation's `predicate.verdict.state` must be `verified`. `partial-ok` also accepts `partial` (but required capabilities, below, must still be verified). `failed` never passes.
- **capabilities × languages** — for every `cap` in `capabilities` and every `lang` in `languages`, the composite key `` `${cap}:${lang}` `` must be present in `predicate.verdict.verifiedCapabilities`. If `languages` is omitted, `capabilities` are matched as-is against the verified set (bare or already-composite). Any missing pair → fail, naming the exact `cap:lang`.
- **signers** — if present and non-empty, a **valid signature is required**: `verifySignature(att.signature)` must be true AND `signatureKeyId(att.signature)` ∈ `signers` (unless `signers` contains `"*"`, which accepts any valid signature). If `signers` is omitted/empty, an unsigned attestation is accepted (integrity-only).
- **freshness** — `head` (default): `att.statement.subject[0].digest.gitCommit` must equal `gitAnchor(root).commit`, and the current tree must be **clean** (`gitAnchor(root).dirty === false`). `off`: skip the freshness check (for verifying a portable attestation about some other commit).

`--pubkey`/`--key-id` on the CLI further constrain the accepted signer (same trust-assertion semantics as `veris evidence verify`), composing with `signers`.

---

## 7. Gate evaluation (honesty-first ordering)

`evaluatePolicy(att, policy, { commit, dirty }) → { passed, checks: Array<{ label, ok, reason }> }`, evaluated and reported in this order:

1. **Integrity** — recompute `attestationDigest(att.statement)`; if `att.signature` present, it must match `att.signature.digest`. Recompute `computeDigest(predicate)` and confirm it equals `predicate.digest` (the evidence wasn't tampered).
2. **Signature/signer** — per §6 `signers` + CLI `--pubkey`/`--key-id`.
3. **Freshness** — subject commit == `commit`, and `dirty === false` (per §6 `freshness`).
4. **Verdict** — per §6 `verdict`.
5. **Required capabilities × languages** — per §6.

`passed` = all applicable checks `ok`. The report lists each with its reason so a failed gate is actionable ("freshness ✗ — attested a1b2c3d, HEAD is e4f5g6h").

---

## 8. Files & modules

- `src/evidence/attestation.ts` — types + `buildAttestation(record)`, `attestationDigest(statement)`, `signAttestation(statement, pem)`, `verifyAttestationSignature(att)`.
- `src/policy/policy.ts` — `Policy`, `DEFAULT_POLICY`, `loadPolicy(root)`, `evaluatePolicy(att, policy, gitState)`.
- `src/evidence/store.ts` — add `attestationsDir(root)`, `writeAttestation(root, id, att)`, `latestAttestation(root)`.
- `src/cli/commands/attest.ts` — `runAttest(root, opts)`.
- `src/cli/commands/gate.ts` — `runGate(root, opts)`.
- `src/cli/index.ts` — register `attest` and `gate` (lazy-imported, matching the existing pattern).
- `src/config/init` / gitignore — `.veris/attestations/` may be committed (attestations are shareable proof) — do **not** gitignore it; `.veris/policy.json` is committed by the user.
- Tests alongside each; a signed round-trip test (keygen → verify → attest → gate pass) and adversarial tests (tampered predicate, wrong commit, dirty tree, missing capability, untrusted signer) — all must fail the gate.

Reuses verbatim: `EvidenceRecord`/`canonicalize`/`sha256`/`computeDigest` (record.ts), `Signature`/`signDigest`/`verifySignature`/`keyId`/`signatureKeyId` (signing.ts), `gitAnchor`/`GitAnchor` (git/changes.ts), `latestRunDir`/`writeEvidence` patterns (store.ts).

---

## 9. Milestones

Each independently shippable and dogfoodable.

1. **Attestation format + signing** — `attestation.ts` (build/digest/sign/verify) + round-trip tests. No CLI yet.
2. **`veris attest` command** — read latest evidence, honesty guards (no-repo/dirty), write signed/unsigned attestation; register in CLI; dogfood on this repo.
3. **Policy + `evaluatePolicy`** — `policy.ts` with the five ordered checks + adversarial unit tests (tamper, stale, dirty, missing cap, untrusted signer).
4. **`veris gate` command** — wire policy + attestation + git state, report + exit codes; register in CLI; dogfood (attest → gate pass; mutate → gate fail).
5. **Docs + honesty pass** — README section, `veris init` writes a starter `.veris/policy.json`, CHANGELOG under `## Unreleased`. **No version bump.**

---

## 10. Honesty & security notes (stated plainly, like the evidence system)

- An attestation proves *a signer asserts this commit reached this verdict with these checks* — it is **not** proof the tests are correct or complete, only that they ran and produced this honest verdict. The predicate's own digest detects tampering; the signature binds a signer; neither is forgery-proof without protecting the signing key.
- `gate` with `signers: ["*"]` accepts *any* valid signature — it proves integrity + a consistent signer, not *authorization*. Real merge protection sets explicit `signers` (CI's key-id) and, in v2, keyless OIDC identities.
- Freshness is the load-bearing honesty property: without it, a stale attestation of an old green commit would pass for changed code. Default `head` + clean-tree is mandatory for a meaningful gate.

---

## 11. Explicit non-goals for v1

Keyless/Sigstore/Rekor · DSSE-PAE cosign interop · public-consumer `verify-attestation` · agent `--json`/`explain` · policy coverage %/time-windows/org-roles · any network, cloud, or storage service. Anything here is refused or deferred with a clear message, not half-built.
