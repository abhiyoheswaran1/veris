import { join } from "node:path";
import {
  type Attestation,
  attestationDigest,
  verifyAttestationSignature,
} from "../evidence/attestation.js";
import { computeDigest } from "../evidence/record.js";
import { signatureKeyId } from "../evidence/signing.js";
import { readJsonIfExists } from "../util/fs-safe.js";

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

export async function loadPolicy(root: string): Promise<Policy> {
  return (
    (await readJsonIfExists<Policy>(join(root, ".veris", "policy.json"))) ??
    DEFAULT_POLICY
  );
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
export function evaluatePolicy(
  att: Attestation,
  policy: Policy,
  git: { commit: string; dirty: boolean } | null,
  trust: { pubKeyId?: string } = {},
): GateResult {
  const req = policy.require ?? {};
  const checks: GateCheck[] = [];

  // 1. Integrity — predicate self-digest + signature-over-this-statement.
  const predicate = att.statement.predicate as unknown as Record<
    string,
    unknown
  > & { digest: string };
  const predOk = computeDigest(predicate) === att.statement.predicate.digest;
  const sigDigestOk =
    !att.signature || att.signature.digest === attestationDigest(att.statement);
  const subjectOk =
    att.statement.subject[0]?.digest.gitCommit ===
    att.statement.predicate.git?.commit;
  checks.push({
    label: "integrity",
    ok: predOk && sigDigestOk && subjectOk,
    reason: !predOk
      ? "predicate digest mismatch (tampered)"
      : !sigDigestOk
        ? "signature is over a different statement"
        : !subjectOk
          ? "subject does not match evidence commit"
          : "record + statement digests intact",
  });

  // 2. Signature / signer — only when required.
  const sigRequired = (req.signers?.length ?? 0) > 0 || Boolean(trust.pubKeyId);
  if (sigRequired) {
    if (!verifyAttestationSignature(att) || !att.signature) {
      checks.push({
        label: "signature",
        ok: false,
        reason:
          "policy requires a valid signature; none present or verification failed",
      });
    } else {
      const kid = signatureKeyId(att.signature);
      const signersOk =
        !req.signers?.length ||
        req.signers.includes("*") ||
        req.signers.includes(kid);
      const trustOk = !trust.pubKeyId || trust.pubKeyId === kid;
      const ok = signersOk && trustOk;
      checks.push({
        label: "signature",
        ok,
        reason: ok ? `signed by ${kid}` : `signer ${kid} is not accepted`,
      });
    }
  }

  // 3. Freshness — digest-protected predicate commit == HEAD and clean tree.
  if ((policy.freshness ?? "head") === "head") {
    const attestedCommit = att.statement.predicate.git?.commit;
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
  const state = att.statement.predicate.verdict.state;
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
    const verified = new Set(
      att.statement.predicate.verdict.verifiedCapabilities,
    );
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
