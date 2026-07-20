import { describe, expect, it } from "vitest";
import {
  ATTESTATION_SCHEMA,
  buildAttestation,
  PREDICATE_TYPE,
  STATEMENT_TYPE,
  signAttestation,
  verifyAttestationSignature,
} from "./attestation.js";
import type { EvidenceRecord } from "./record.js";
import { generateKeyPair } from "./signing.js";

function record(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  const base: EvidenceRecord = {
    schema: "veriskit/evidence@1",
    id: "run-1",
    startedAt: "2026-07-19T00:00:00.000Z",
    tool: { name: "veriskit", version: "0.6.1" },
    git: {
      commit: "a".repeat(40),
      branch: "main",
      dirty: false,
      changedFiles: 0,
    },
    env: { os: "linux", node: "v24", pm: "npm", ci: false, timestamp: "t" },
    project: {
      name: "demo",
      packageManager: "npm",
      frameworks: [],
      languages: ["js"],
    },
    scope: { kind: "full", changedCount: 0 },
    checks: [],
    verdict: {
      state: "verified",
      verifiedCapabilities: ["unit:js"],
      skipped: [],
      reasons: [],
    },
    digest: "sha256:placeholder",
  };
  return { ...base, ...overrides };
}

describe("buildAttestation", () => {
  it("wraps the record as an in-toto statement subject-ed to the git commit", () => {
    const att = buildAttestation(record());
    expect(att.schema).toBe(ATTESTATION_SCHEMA);
    expect(att.statement._type).toBe(STATEMENT_TYPE);
    expect(att.statement.predicateType).toBe(PREDICATE_TYPE);
    expect(att.statement.subject[0]).toEqual({
      name: "demo",
      digest: { gitCommit: "a".repeat(40) },
    });
    expect(att.statement.predicate.verdict.state).toBe("verified");
    expect(att.signature).toBeNull();
  });

  it("throws when the record has no git anchor", () => {
    expect(() => buildAttestation(record({ git: null }))).toThrow(/git/);
  });
});

describe("signAttestation / verifyAttestationSignature", () => {
  it("round-trips a signature", () => {
    const kp = generateKeyPair();
    const signed = signAttestation(
      buildAttestation(record()),
      kp.privateKeyPem,
    );
    expect(signed.signature).not.toBeNull();
    expect(verifyAttestationSignature(signed)).toBe(true);
  });

  it("rejects a signature after the statement is tampered", () => {
    const kp = generateKeyPair();
    const signed = signAttestation(
      buildAttestation(record()),
      kp.privateKeyPem,
    );
    signed.statement.predicate.verdict.state = "failed"; // tamper
    expect(verifyAttestationSignature(signed)).toBe(false);
  });

  it("is false for an unsigned attestation", () => {
    expect(verifyAttestationSignature(buildAttestation(record()))).toBe(false);
  });
});
