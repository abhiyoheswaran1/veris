import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type Attestation,
  attestationDigest,
  attestationStatement,
  verifyAttestationSignature,
} from "../evidence/attestation.js";
import {
  ATTESTATION_SCHEMA_V2,
  type AttestationV2,
  envelopePae,
} from "../evidence/dsse.js";
import { canonicalize, computeDigest } from "../evidence/record.js";
import { signatureKeyId } from "../evidence/signing.js";
import { ed25519Verifier } from "../signing/ed25519.js";

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

// Loads .veris/policy.json. Absent is a normal, permissive state (the
// starter default). Present-but-unparseable is NOT: a corrupt or
// merge-conflicted policy file must never silently downgrade enforcement, so
// it throws instead of falling back to DEFAULT_POLICY.
export async function loadPolicy(root: string): Promise<Policy> {
  const path = join(root, ".veris", "policy.json");
  if (!existsSync(path)) return DEFAULT_POLICY;
  try {
    return JSON.parse(await readFile(path, "utf8")) as Policy;
  } catch {
    throw new Error(`malformed policy at ${path}`);
  }
}

// Loads a policy from an explicit path (e.g. `gate --policy <path>`). Unlike
// loadPolicy, a missing file here is also an error — there is no notion of
// "absent means default" when the caller named a specific file.
export async function loadPolicyFile(path: string): Promise<Policy> {
  if (!existsSync(path)) {
    throw new Error(`cannot read policy at ${path}`);
  }
  try {
    return JSON.parse(await readFile(path, "utf8")) as Policy;
  } catch {
    throw new Error(`malformed policy at ${path}`);
  }
}

export interface GateCheck {
  label: string;
  ok: boolean;
  reason: string;
}
export interface GateResult {
  passed: boolean;
  checks: GateCheck[];
}

// Evaluate an attestation against a policy. `git` is the current repo state
// (null outside a repo). `trust.pubKeyId` is the key id derived from a CLI
// --pubkey / --key-id, which further constrains the accepted signer.
//
// Accepts both the legacy @1 (schema-signed statement) and the @2 (DSSE /
// ed25519) attestation shapes. The KEY INVARIANT: `att.schema` alone decides
// both which statement is read (via `attestationStatement`, which is strict
// — see its doc comment) and which signature path runs, so no code path can
// ever verify a signature over one statement while reading predicate data
// from another. `attestationStatement` throws on a malformed or unknown
// schema; that throw is intentionally NOT caught here — it propagates to the
// caller (gateProject wraps this in try/catch and fails closed).
export async function evaluatePolicy(
  att: Attestation | AttestationV2,
  policy: Policy,
  git: { commit: string; dirty: boolean } | null,
  trust: { pubKeyId?: string } = {},
): Promise<GateResult> {
  const req = policy.require ?? {};
  const checks: GateCheck[] = [];
  const isV2 = att.schema === ATTESTATION_SCHEMA_V2;

  const stmt = attestationStatement(att); // throws on malformed/unknown schema — intentionally uncaught here

  // 1. Integrity — predicate self-digest, subject/commit match, and (for @2)
  // confirmation that the envelope payload IS the canonical statement we
  // just read (the thing signed is the thing read).
  const predicate = stmt.predicate as unknown as Record<string, unknown> & {
    digest: string;
  };
  const predOk = computeDigest(predicate) === stmt.predicate.digest;
  const subjectOk =
    stmt.subject[0]?.digest.gitCommit === stmt.predicate.git?.commit;

  let sigOverStatementOk: boolean;
  let sigOverStatementReason = "signature is over a different statement";
  if (isV2) {
    const env = (att as AttestationV2).envelope;
    const raw = Buffer.from(env.payload, "base64").toString("utf8");
    sigOverStatementOk = raw === canonicalize(stmt);
    sigOverStatementReason = "envelope payload does not match the statement";
  } else {
    const a1 = att as Attestation;
    sigOverStatementOk =
      !a1.signature || a1.signature.digest === attestationDigest(a1.statement);
  }

  checks.push({
    label: "integrity",
    ok: predOk && sigOverStatementOk && subjectOk,
    reason: !predOk
      ? "predicate digest mismatch (tampered)"
      : !sigOverStatementOk
        ? sigOverStatementReason
        : !subjectOk
          ? "subject does not match evidence commit"
          : "record + statement digests intact",
  });

  // 2. Signature / signer — only when required.
  // Normalize signers so a lone string (e.g. from hand-edited JSON) becomes
  // an exact-match single-element list rather than being iterated char by
  // char or otherwise mistreated as an array-like.
  const signers: string[] = Array.isArray(req.signers)
    ? req.signers
    : req.signers != null
      ? [String(req.signers)]
      : [];
  const sigRequired = signers.length > 0 || Boolean(trust.pubKeyId);
  if (sigRequired) {
    if (isV2) {
      const env = (att as AttestationV2).envelope;
      const paeBytes = envelopePae(env);
      let acceptedKid: string | null = null;
      let reason =
        "policy requires a valid signature; none present or verification failed";
      for (const sig of env.signatures) {
        if (sig.backend === "cosign") {
          reason = "cosign verification not yet supported";
          continue;
        }
        if (sig.backend === "ed25519") {
          const res = await ed25519Verifier.verify(paeBytes, sig, {
            signers,
            pubKeyId: trust.pubKeyId,
          });
          if (res.ok) {
            // Use the verifier-derived keyid (recomputed from the actual
            // public key), not sig.keyid — the latter is attacker-supplied
            // and must never be trusted for display purposes.
            acceptedKid = res.keyid ?? "";
            break;
          }
          reason = res.reason;
        }
      }
      checks.push({
        label: "signature",
        ok: acceptedKid !== null,
        reason: acceptedKid !== null ? `signed by ${acceptedKid}` : reason,
      });
    } else {
      const a1 = att as Attestation;
      if (!verifyAttestationSignature(a1) || !a1.signature) {
        checks.push({
          label: "signature",
          ok: false,
          reason:
            "policy requires a valid signature; none present or verification failed",
        });
      } else {
        const kid = signatureKeyId(a1.signature);
        const signersOk =
          signers.length === 0 ||
          signers.includes("*") ||
          signers.includes(kid);
        const trustOk = !trust.pubKeyId || trust.pubKeyId === kid;
        const ok = signersOk && trustOk;
        checks.push({
          label: "signature",
          ok,
          reason: ok ? `signed by ${kid}` : `signer ${kid} is not accepted`,
        });
      }
    }
  }

  // 3. Freshness — digest-protected predicate commit == HEAD and clean tree.
  if ((policy.freshness ?? "head") === "head") {
    const attestedCommit = stmt.predicate.git?.commit;
    if (!git) {
      checks.push({
        label: "freshness",
        ok: false,
        reason: "not in a git repository",
      });
    } else {
      const commitOk = attestedCommit === git.commit;
      const ok = commitOk && !git.dirty;
      checks.push({
        label: "freshness",
        ok,
        reason: !commitOk
          ? `attested ${attestedCommit?.slice(0, 7)}, HEAD is ${git.commit.slice(0, 7)}`
          : git.dirty
            ? "working tree is dirty"
            : "matches current HEAD, tree clean",
      });
    }
  }

  // 4. Verdict.
  const wantVerdict = req.verdict ?? "verified";
  const state = stmt.predicate.verdict.state;
  const verdictOk =
    state === "verified" ||
    (wantVerdict === "partial-ok" && state === "partial");
  checks.push({
    label: "verdict",
    ok: verdictOk,
    reason: verdictOk
      ? `verdict ${state}`
      : `verdict ${state} does not meet ${wantVerdict}`,
  });

  // 5. Required capabilities × languages.
  const caps = req.capabilities ?? [];
  if (caps.length > 0) {
    const verified = new Set(stmt.predicate.verdict.verifiedCapabilities);
    const langs = req.languages ?? [];
    const missing: string[] = [];
    for (const cap of caps) {
      if (langs.length === 0) {
        const ok =
          verified.has(cap) ||
          [...verified].some((k) => k.split(":")[0] === cap);
        if (!ok) missing.push(cap);
      } else {
        for (const lang of langs) {
          const key = `${cap}:${lang}`;
          if (!verified.has(key)) missing.push(key);
        }
      }
    }
    checks.push({
      label: "coverage",
      ok: missing.length === 0,
      reason:
        missing.length === 0
          ? "all required checks verified"
          : `not verified: ${missing.join(", ")}`,
    });
  }

  return { passed: checks.every((c) => c.ok), checks };
}
