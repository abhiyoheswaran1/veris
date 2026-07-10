import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { buildRecord } from "./record.js";
import { generateKeyPair, signDigest } from "./signing.js";
import { signatureChecks, verifyRecord } from "./verify-evidence.js";

function run(): VerificationRun {
  return {
    id: "r1",
    startedAt: "t",
    project: {
      root: "/x",
      name: "n",
      packageManager: "npm",
      frameworks: [],
      languages: [],
      scripts: {},
      capabilities: [{ id: "unit", available: true, runner: "vitest" }],
    },
    results: [
      { checkId: "unit", status: "passed", durationMs: 1, summary: "ok" },
    ],
    verdict: {
      state: "verified",
      verifiedCapabilities: ["unit"],
      skipped: [],
      reasons: [],
    },
    env: { os: "x", node: "v24", pm: "npm", ci: false, timestamp: "t" },
  };
}

describe("verifyRecord", () => {
  it("passes for an untouched record", () => {
    const result = verifyRecord(buildRecord(run(), null, {}, "0.4.0"));
    expect(result.ok).toBe(true);
    expect(result.kind).toBe("record");
  });

  it("fails when a field was edited after signing", () => {
    const rec = buildRecord(run(), null, {}, "0.4.0");
    rec.verdict.state = "failed"; // tamper, digest not recomputed
    const result = verifyRecord(rec);
    expect(result.ok).toBe(false);
    expect(result.checks.find((c) => c.name === "record digest")?.ok).toBe(
      false,
    );
  });
});

describe("signatureChecks", () => {
  it("passes for a valid signature over the record digest", () => {
    const kp = generateKeyPair();
    const rec = buildRecord(run(), null, {}, "0.4.1");
    const sig = signDigest(rec.digest, kp.privateKeyPem);
    const checks = signatureChecks(rec.digest, sig);
    expect(checks.find((c) => c.name === "signature")?.ok).toBe(true);
  });

  it("fails when the signature is over a different digest", () => {
    const kp = generateKeyPair();
    const rec = buildRecord(run(), null, {}, "0.4.1");
    const sig = signDigest("sha256:somethingelse", kp.privateKeyPem);
    const checks = signatureChecks(rec.digest, sig);
    expect(checks.find((c) => c.name === "signature")?.ok).toBe(false);
  });

  it("adds a signer check that fails on a key-id mismatch", () => {
    const kp = generateKeyPair();
    const rec = buildRecord(run(), null, {}, "0.4.1");
    const sig = signDigest(rec.digest, kp.privateKeyPem);
    const checks = signatureChecks(rec.digest, sig, {
      expectedKeyId: "deadbeef",
    });
    expect(checks.find((c) => c.name === "signer")?.ok).toBe(false);
  });

  it("signer check passes when the expected key-id matches", () => {
    const kp = generateKeyPair();
    const rec = buildRecord(run(), null, {}, "0.4.1");
    const sig = signDigest(rec.digest, kp.privateKeyPem);
    const checks = signatureChecks(rec.digest, sig, {
      expectedKeyId: kp.keyId,
    });
    expect(checks.find((c) => c.name === "signer")?.ok).toBe(true);
  });
});
