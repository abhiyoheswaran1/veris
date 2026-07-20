# Veris Keyless Signing (DSSE + cosign) — Design Spec

**Date:** 2026-07-20
**Status:** Approved (brainstorm) — ready for implementation plan
**Scope:** v0.8.0 first cut — DSSE envelope format + `ed25519` (native) and `cosign` (keyless) signing backends + keyless-identity policy trust. Native `sigstore-js` and a public `verify-attestation` flow are explicitly deferred.

---

## 1. Thesis

VerisKit already produces a signed in-toto attestation of the exact verified commit. This makes that attestation a **standards-compliant, ecosystem-native, keyless-capable** artifact — without betraying the dep-light thesis.

Two moves:
1. **Format:** wrap the in-toto Statement in a real **DSSE envelope** (PAE signing), so a VerisKit attestation is natively verifiable by cosign and consumable across the supply-chain ecosystem (SLSA, GitHub artifact attestations, npm provenance, sigstore-policy-controller). Format work, **zero dependencies**.
2. **Signing behind an interface** with pluggable backends: `ed25519` (existing, built-in, zero-dep, keyed) and `cosign` (**keyless** via Fulcio + Rekor, orchestrated — shelled out to an installed `cosign`, detected-and-reported when absent, exactly as VerisKit treats pytest). A future native `sigstore` backend becomes a drop-in, not a rewrite.

The default path stays dep-light orchestration; the architecture is powerful enough to grow. Keyless via cosign gives the same Fulcio/Rekor guarantees as embedding `sigstore-js`, with **no new runtime dependencies**.

### Why this over "just embed sigstore-js"

cosign-orchestration yields identical keyless guarantees (same Fulcio, same transparency log) with zero deps and is on-brand (orchestrate the mature tool). The `Signer` interface means embedding `sigstore-js` later — if a zero-external-tool keyless path is ever demanded — is additive, so we foreclose nothing.

---

## 2. Scope

### In (v0.8.0)

- **DSSE envelope format** (`veriskit/attestation@2`): the attestation is a DSSE envelope over the canonical in-toto Statement; signatures are PAE-based.
- **`Signer`/`Verifier` interface** with two backends:
  - `ed25519` — native PAE sign/verify using Node built-in crypto (migrates the existing signing onto DSSE).
  - `cosign` — keyless: VerisKit produces the Statement, `cosign` signs it keyless (Fulcio cert + Rekor), and gate verifies via `cosign` with a pinned OIDC identity.
- `veris attest --keyless` (cosign backend) and the default (ed25519 when a key is available, else unsigned), all producing a DSSE envelope.
- `veris gate` verifies DSSE for both backends; `require.signers` accepts a key-id **or** a keyless identity `{ issuer, subject }`.
- **cosign capability detection** — `doctor` reports whether `cosign` is available (like a runner).
- **Backward compatibility:** `gate` verifies both `@1` (legacy, deprecated) and `@2` (DSSE) attestations; new writes are `@2`.

### Out (deferred)

- Native `sigstore-js`/`@sigstore/*` backend (the interface makes it a later drop-in).
- Public-consumer `veris verify-attestation <pkg>` flow (reuses the DSSE verifier + a public trust root — next increment).
- OCI/registry attestation storage; `--tlog-upload` policy controls beyond present/absent; multi-signature (threshold) envelopes.
- Full offline Rekor inclusion-proof verification without cosign (cosign owns that here).

---

## 3. DSSE envelope format (`veriskit/attestation@2`)

The attestation file becomes a DSSE envelope carrying the in-toto Statement, plus a thin VerisKit wrapper recording which backend signed.

```ts
export const ATTESTATION_SCHEMA_V2 = "veriskit/attestation@2";
export const DSSE_PAYLOAD_TYPE = "application/vnd.in-toto+json";

export interface DsseSignature {
  keyid?: string;      // key id (ed25519) or omitted for keyless
  sig: string;         // base64 signature over the PAE
  cert?: string;       // base64 PEM cert (cosign/Fulcio keyless), else omitted
  backend: "ed25519" | "cosign"; // which Signer produced it
  tlogId?: string;     // Rekor log id / index for keyless (informational)
}

export interface DsseEnvelope {
  payloadType: string;       // DSSE_PAYLOAD_TYPE
  payload: string;           // base64 of canonicalize(statement)
  signatures: DsseSignature[];
}

export interface AttestationV2 {
  schema: string;            // ATTESTATION_SCHEMA_V2
  envelope: DsseEnvelope;    // the signed DSSE envelope
}
```

- `payload` = base64 of `canonicalize(statement)` (the existing deterministic serialization from `record.ts`), so the digest/subject binding from v1 (subject commit == `predicate.git.commit`) is preserved inside the Statement.
- **PAE** (DSSE Pre-Authentication Encoding — the bytes actually signed):
  `PAE = "DSSEv1" SP LEN(payloadType) SP payloadType SP LEN(body) SP body`
  where `body` is the raw (pre-base64) canonical Statement bytes and `LEN` is the ASCII decimal byte length. This matches the DSSE spec exactly, so cosign and any DSSE verifier interoperate.
- Unsigned attestations are allowed (empty `signatures: []`) — integrity-only, same philosophy as v1.

---

## 4. `Signer` / `Verifier` interface

```ts
export interface Signer {
  backend: "ed25519" | "cosign";
  // Sign the PAE bytes; return the DSSE signature entry.
  sign(pae: Buffer, statement: Statement): Promise<DsseSignature>;
}

export interface Verifier {
  // Verify one DSSE signature over the PAE. `trust` carries the policy's
  // accepted signers (key-ids and/or keyless identities).
  verify(
    pae: Buffer,
    sig: DsseSignature,
    trust: SignerTrust,
  ): Promise<{ ok: boolean; identity?: KeylessIdentity; reason: string }>;
}
```

- **`ed25519` backend** (native, zero-dep): `sign` computes the PAE, signs with Node `crypto.sign(null, pae, privateKey)`, returns `{ backend:"ed25519", keyid, sig }` (reuses `keyId`/key handling from `signing.ts`). `verify` checks the Ed25519 signature over the PAE against the embedded/allowed public key. This replaces the v1 `signDigest`-over-a-digest scheme with proper PAE-over-the-envelope.
- **`cosign` backend** (orchestrated keyless, zero-dep): `sign` writes the canonical Statement to a temp file and shells `cosign` to produce a keyless signature + Fulcio cert (+ Rekor upload), returning `{ backend:"cosign", sig, cert, tlogId }`. `verify` shells `cosign` to verify the signature/cert against the policy's pinned `{ issuer, subject }` and Rekor inclusion. The **exact cosign subcommands and flags are pinned to a supported cosign version in the implementation plan** (cosign's blob-attestation CLI has evolved); this spec fixes the contract (VerisKit owns the Statement + PAE; cosign owns the keyless crypto + transparency log), not the incantation.

Binaries are resolved/detected the same way as other tools (a `cosign` capability in `doctor`; absent → keyless is reported unavailable, never a crash).

---

## 5. `veris attest` changes

```
veris attest [--keyless] [--key <path>] [--out <path>]
```

- Default: if a key is available (`VERISKIT_SIGNING_KEY`/`--key`) → `ed25519` backend; else unsigned. Always emits a `@2` DSSE envelope.
- `--keyless`: use the `cosign` backend (requires `cosign` present + an OIDC token — ambient in CI, interactive locally). If `cosign` is absent, fail with a clear message (`cosign not found — install it or use --key`), never a crash.
- Guards from v0.7.2 are unchanged (no run / no repo / dirty-at-verify / live dirty / stale evidence). `attestProject` grows a `backend`/`keyless` option and returns the backend + identity in `AttestOutcome`.

---

## 6. `veris gate` + policy changes

`require.signers` entries become a union:

```jsonc
{
  "require": {
    "signers": [
      "a1b2c3d4",                                  // ed25519 key-id (as today)
      { "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:org/repo:ref:refs/heads/main" }  // keyless identity
    ]
  }
}
```

```ts
export type SignerRef =
  | string                                   // key-id (ed25519) or "*"
  | { issuer: string; subject: string };     // keyless OIDC identity

export interface KeylessIdentity { issuer: string; subject: string }
```

Gate's signature check (still one of the five honesty-ordered checks) becomes:
- Recompute the PAE from the envelope's payload; for each required signer, run the matching `Verifier`:
  - key-id / `*` → `ed25519` verifier over the PAE.
  - `{issuer, subject}` → `cosign` verifier (`cosign verify-blob …` with `--certificate-identity subject --certificate-oidc-issuer issuer`), which also confirms Rekor inclusion.
- A signature is accepted only if it verifies **and** its signer matches an allowed `SignerRef`. Integrity (Statement digest + subject==predicate.git.commit) and freshness/verdict/coverage are unchanged from v1.
- `--pubkey`/`--key-id` continue to further constrain the ed25519 path.

Honesty preserved: with no `require.signers`, gate is integrity-only (does not establish authorship) — documented as before. Keyless raises the ceiling: *"verified and signed by our CI's real OIDC identity, logged in a public transparency ledger,"* with no key to steal or distribute.

---

## 7. Files & modules

- `src/evidence/dsse.ts` — NEW: `DsseEnvelope`/`AttestationV2` types, `pae(payloadType, body)`, `buildEnvelope(statement)`, `envelopeDigest`, base64 helpers.
- `src/signing/signer.ts` — NEW: `Signer`/`Verifier` interfaces + `SignerTrust`/`SignerRef`/`KeylessIdentity`.
- `src/signing/ed25519.ts` — NEW: native PAE sign/verify (reusing `signing.ts` key handling).
- `src/signing/cosign.ts` — NEW: cosign-orchestrated keyless sign/verify (shells via the existing `exec`); cosign detection.
- `src/evidence/attestation.ts` — build `@2` DSSE attestations; keep `@1` read for gate compat.
- `src/evidence/attestation-project.ts` — `attestProject` grows `{ keyless?: boolean }`, selects the backend, returns backend + identity.
- `src/policy/policy.ts` — `SignerRef` union; signature check dispatches to the right `Verifier`; keyless identity matching.
- `src/policy/gate-project.ts` — unchanged flow; consumes the extended policy.
- `src/config/detect.ts` / `doctor` — a `cosign` capability (present/absent).
- `mcp` — `veris_attest` gains an optional `keyless` arg (later; not blocking).
- Tests alongside; a DSSE conformance test (PAE bytes match the spec vector) and an ed25519 round-trip; cosign paths tested with a stubbed `exec` (no network in unit tests).

Reuses: `canonicalize`/`sha256` (record.ts), `keyId`/key handling (signing.ts), `exec` (util), `evaluatePolicy` structure (policy.ts), attestation guards (attestation-project.ts).

---

## 8. Migration & compatibility

- New attestations are `@2` DSSE. `gate` reads and verifies both `@1` (legacy homegrown signature) and `@2` (DSSE) during a deprecation window; `attest` only writes `@2`.
- Because attestations are commit-anchored and freshness-gated, they are already short-lived — re-attesting after upgrade is cheap. `@1` support is a courtesy, removable in a later major.
- The `Signature` type and `signDigest`/`verifySignature` in `signing.ts` remain (used by `@1` read + the evidence-signing commands), so `veris evidence sign/verify` is unaffected.

---

## 9. Milestones

1. **DSSE core** — `dsse.ts` (envelope + PAE) + conformance tests. No signing wired yet.
2. **ed25519 backend on DSSE** — `Signer`/`Verifier` interface + native backend; `attest`/`gate` emit/verify `@2` with ed25519; `@1` read retained. (Keyless not yet.)
3. **cosign keyless backend** — `cosign.ts` sign/verify (exec-orchestrated, stubbed in tests), `--keyless`, cosign detection in `doctor`.
4. **Keyless policy trust** — `SignerRef` union + identity matching in `evaluatePolicy`; gate accepts `{issuer, subject}`.
5. **Docs + honesty pass + changelog** — README keyless section (with the honest "integrity-only vs signed-identity" framing), `## Unreleased` → 0.8.0. Dogfood keyless end-to-end where cosign is available.

---

## 10. Honesty & security notes

- Keyless proves *a specific OIDC identity signed this exact commit's verification, logged in a public transparency ledger* — stronger than a key-id (no key to steal/distribute), and independently checkable by anyone with cosign. It is still **not** proof the tests are correct/complete — only that they ran and produced this honest verdict.
- Integrity (Statement digest + subject-binding) and freshness remain the load-bearing honesty properties; keyless strengthens *authorship*, not *coverage*.
- The DSSE PAE binding means tampering with the payload invalidates every signature; the subject-commit binding (from v1) means a swapped subject fails integrity before signatures are even checked.

---

## 11. Explicit non-goals for v0.8.0

Native `sigstore-js` embedding · public `verify-attestation <pkg>` · OCI/registry storage · threshold/multi-party signing · offline Rekor proof verification without cosign · replacing `veris evidence sign/verify`. Deferred with a clear message, not half-built.
