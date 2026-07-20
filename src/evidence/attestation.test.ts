import { describe, expect, it } from "vitest";
import { ed25519Verifier } from "../signing/ed25519.js";
import {
  ATTESTATION_SCHEMA,
  attestationStatement,
  buildAttestation,
  buildAttestationV2,
  PREDICATE_TYPE,
  STATEMENT_TYPE,
  signAttestation,
  signAttestationV2,
  verifyAttestationSignature,
} from "./attestation.js";
import { ATTESTATION_SCHEMA_V2, envelopePae } from "./dsse.js";
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

describe("buildAttestationV2", () => {
  it("wraps the record as a DSSE @2 envelope over the same statement", () => {
    const att = buildAttestationV2(record());
    expect(att.schema).toBe(ATTESTATION_SCHEMA_V2);
    expect(att.envelope.signatures).toEqual([]);
    const statement = JSON.parse(
      Buffer.from(att.envelope.payload, "base64").toString("utf8"),
    );
    expect(statement._type).toBe(STATEMENT_TYPE);
    expect(statement.predicateType).toBe(PREDICATE_TYPE);
    expect(statement.subject[0]).toEqual({
      name: "demo",
      digest: { gitCommit: "a".repeat(40) },
    });
  });

  it("throws when the record has no git anchor", () => {
    expect(() => buildAttestationV2(record({ git: null }))).toThrow(/git/);
  });
});

describe("signAttestationV2", () => {
  it("produces a signature verifiable over the envelope PAE", async () => {
    const kp = generateKeyPair();
    const att = buildAttestationV2(record());
    const signed = await signAttestationV2(att, kp.privateKeyPem);
    expect(signed.envelope.signatures).toHaveLength(1);
    const sig = signed.envelope.signatures[0];
    expect(sig).toBeDefined();
    if (!sig) throw new Error("unreachable");
    expect(sig.backend).toBe("ed25519");
    const result = await ed25519Verifier.verify(
      envelopePae(signed.envelope),
      sig,
      { signers: ["*"] },
    );
    expect(result.ok).toBe(true);
    // Original attestation's envelope is untouched (copy, not mutate).
    expect(att.envelope.signatures).toEqual([]);
  });
});

describe("attestationStatement", () => {
  it("returns the same subject for a @1 and a @2 attestation of the same record", () => {
    const rec = record();
    const v1 = buildAttestation(rec);
    const v2 = buildAttestationV2(rec);
    expect(attestationStatement(v1).subject).toEqual(
      attestationStatement(v2).subject,
    );
  });
});
