import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { EvidenceRecord } from "./record.js";
import { computeDigest } from "./record.js";
import {
  keyId,
  type Signature,
  signatureKeyId,
  verifySignature,
} from "./signing.js";

export interface EvidenceCheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  kind: "record" | "bundle";
  record: EvidenceRecord;
  checks: EvidenceCheckResult[];
  signed: boolean;
}

export function verifyRecord(record: EvidenceRecord): VerifyResult {
  const recomputed = computeDigest(
    record as unknown as Record<string, unknown>,
  );
  const ok = recomputed === record.digest;
  const checks: EvidenceCheckResult[] = [
    {
      name: "record digest",
      ok,
      detail: ok
        ? "matches the canonical record"
        : `recomputed ${recomputed}, record claims ${record.digest}`,
    },
  ];
  return { ok, kind: "record", record, checks, signed: false };
}

export interface VerifyOptions {
  sigPath?: string;
  expectedKeyId?: string;
  expectedPubKeyPem?: string;
}

export function signatureChecks(
  recordDigest: string,
  sig: Signature,
  opts: { expectedKeyId?: string; expectedPubKeyPem?: string } = {},
): EvidenceCheckResult[] {
  const checks: EvidenceCheckResult[] = [];
  const kid = signatureKeyId(sig);
  const validSig = verifySignature(sig) && sig.digest === recordDigest;
  checks.push({
    name: "signature",
    ok: validSig,
    detail: validSig
      ? `valid ed25519 signature by key ${kid}`
      : "signature does not match this record",
  });

  if (opts.expectedKeyId || opts.expectedPubKeyPem) {
    let matches = false;
    if (opts.expectedPubKeyPem) {
      try {
        matches = keyId(opts.expectedPubKeyPem) === kid;
      } catch {
        matches = false;
      }
    } else if (opts.expectedKeyId) {
      matches = opts.expectedKeyId.toLowerCase() === kid.toLowerCase();
    }
    checks.push({
      name: "signer",
      ok: matches,
      detail: matches
        ? `signer matches the expected key ${kid}`
        : `signer ${kid} does not match the expected key`,
    });
  }
  return checks;
}

export async function verifyEvidenceFile(
  path: string,
  opts: VerifyOptions = {},
): Promise<VerifyResult> {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (parsed?.schema === "veriskit/bundle@1") {
    const { verifyBundle } = await import("./bundle.js");
    return verifyBundle(parsed, opts);
  }

  const result = verifyRecord(parsed as EvidenceRecord);

  const sigPath = opts.sigPath ?? `${path}.sig`;
  if (existsSync(sigPath)) {
    const sig = JSON.parse(await readFile(sigPath, "utf8")) as Signature;
    result.checks.push(
      ...signatureChecks(result.record.digest, sig, {
        expectedKeyId: opts.expectedKeyId,
        expectedPubKeyPem: opts.expectedPubKeyPem,
      }),
    );
    result.signed = true;
    result.ok = result.checks.every((c) => c.ok);
  }
  return result;
}
