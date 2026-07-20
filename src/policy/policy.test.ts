import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type Attestation,
  attestationStatement,
  buildAttestation,
  buildAttestationV2,
  signAttestation,
  signAttestationV2,
} from "../evidence/attestation.js";
import type { EvidenceRecord } from "../evidence/record.js";
import { computeDigest } from "../evidence/record.js";
import { generateKeyPair, signatureKeyId } from "../evidence/signing.js";
import {
  DEFAULT_POLICY,
  evaluatePolicy,
  loadPolicy,
  loadPolicyFile,
  type Policy,
} from "./policy.js";

const COMMIT = "a".repeat(40);

function record(
  over: Partial<EvidenceRecord["verdict"]> = {},
  commit = COMMIT,
): EvidenceRecord {
  const base = {
    schema: "veriskit/evidence@1",
    id: "r1",
    startedAt: "t",
    tool: { name: "veriskit", version: "0.6.1" },
    git: { commit, branch: "main", dirty: false, changedFiles: 0 },
    env: { os: "linux", node: "v24", pm: "npm", ci: false, timestamp: "t" },
    project: {
      name: "demo",
      packageManager: "npm",
      frameworks: [],
      languages: ["js"],
    },
    scope: { kind: "full" as const, changedCount: 0 },
    checks: [],
    verdict: {
      state: "verified" as const,
      verifiedCapabilities: ["unit:js", "types:js"],
      skipped: [],
      reasons: [],
      ...over,
    },
  };
  return { ...base, digest: computeDigest(base) } as EvidenceRecord;
}

const git = { commit: COMMIT, dirty: false };

describe("evaluatePolicy — @1 legacy attestations", () => {
  it("passes a signed, fresh, verified attestation meeting coverage (legacy @1 back-compat)", async () => {
    const kp = generateKeyPair();
    const att = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    const policy: Policy = {
      require: {
        verdict: "verified",
        capabilities: ["unit"],
        languages: ["js"],
        signers: [signatureKeyId(att.signature!)],
      },
      freshness: "head",
    };
    const r = await evaluatePolicy(att, policy, git);
    expect(r.passed).toBe(true);
  });

  it("fails on a tampered predicate (integrity)", async () => {
    const att = buildAttestation(record());
    att.statement.predicate.verdict.state = "failed"; // digest no longer matches
    const r = await evaluatePolicy(att, DEFAULT_POLICY, git);
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.label === "integrity")?.ok).toBe(false);
  });

  it("fails a stale commit (freshness)", async () => {
    const att = buildAttestation(record({}, "b".repeat(40)));
    const r = await evaluatePolicy(att, DEFAULT_POLICY, git);
    expect(r.checks.find((c) => c.label === "freshness")?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("fails a dirty tree (freshness)", async () => {
    const att = buildAttestation(record());
    const r = await evaluatePolicy(att, DEFAULT_POLICY, {
      commit: COMMIT,
      dirty: true,
    });
    expect(r.checks.find((c) => c.label === "freshness")?.ok).toBe(false);
  });

  it("fails a partial verdict under require verified, passes under partial-ok", async () => {
    const att = buildAttestation(record({ state: "partial" }));
    expect(
      (
        await evaluatePolicy(
          att,
          { require: { verdict: "verified" }, freshness: "off" },
          git,
        )
      ).passed,
    ).toBe(false);
    expect(
      (
        await evaluatePolicy(
          att,
          { require: { verdict: "partial-ok" }, freshness: "off" },
          git,
        )
      ).passed,
    ).toBe(true);
  });

  it("fails when a required capability×language is not verified", async () => {
    const att = buildAttestation(record());
    const r = await evaluatePolicy(
      att,
      {
        require: { capabilities: ["unit"], languages: ["python"] },
        freshness: "off",
      },
      git,
    );
    expect(r.checks.find((c) => c.label === "coverage")?.ok).toBe(false);
    expect(r.checks.find((c) => c.label === "coverage")?.reason).toContain(
      "unit:python",
    );
  });

  it("requires a valid signature when signers is set; unsigned fails", async () => {
    const att = buildAttestation(record()); // unsigned
    const r = await evaluatePolicy(
      att,
      { require: { signers: ["*"] }, freshness: "off" },
      git,
    );
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
  });

  it("rejects an untrusted signer", async () => {
    const kp = generateKeyPair();
    const att = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    const r = await evaluatePolicy(
      att,
      { require: { signers: ["deadbeef"] }, freshness: "off" },
      git,
    );
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
  });

  it("rejects a forged subject that no longer matches the digest-protected evidence commit", async () => {
    // Unsigned attestation whose real (digest-protected) evidence is for a
    // stale commit. An attacker edits ONLY the subject (which lives outside
    // the predicate digest) to point at current HEAD.
    const att = buildAttestation(record({}, "b".repeat(40)));
    const subject = att.statement.subject[0];
    if (subject) subject.digest.gitCommit = COMMIT;
    const r = await evaluatePolicy(att, DEFAULT_POLICY, git);
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.label === "integrity")?.ok).toBe(false);
  });

  it("matches a capability-only requirement against composite verifiedCapabilities keys", async () => {
    const att = buildAttestation(record());
    const r = await evaluatePolicy(
      att,
      { require: { capabilities: ["unit"] }, freshness: "off" },
      git,
    );
    expect(r.passed).toBe(true);
  });

  it("treats a lone string signer as an exact-match single-element list, not a substring match", async () => {
    const kp = generateKeyPair();
    const att = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    if (!att.signature) throw new Error("expected a signature");
    const kid = signatureKeyId(att.signature);

    // Hand-edited policy where `signers` is a bare string, not an array.
    const policy = {
      require: { signers: kid as unknown as string[] },
      freshness: "off",
    } satisfies Policy;
    expect((await evaluatePolicy(att, policy, git)).passed).toBe(true);

    // A different id must NOT pass just because it shares characters with kid.
    const otherPolicy = {
      require: { signers: `x${kid}` as unknown as string[] },
      freshness: "off",
    } satisfies Policy;
    expect((await evaluatePolicy(att, otherPolicy, git)).passed).toBe(false);
  });
});

describe("evaluatePolicy — @2 DSSE/ed25519 attestations", () => {
  it("passes a signed @2 attestation whose signer matches policy.require.signers", async () => {
    const kp = generateKeyPair();
    const att = await signAttestationV2(
      buildAttestationV2(record()),
      kp.privateKeyPem,
    );
    const kid = att.envelope.signatures[0]?.keyid;
    if (!kid) throw new Error("expected a signature");
    const policy: Policy = {
      require: {
        verdict: "verified",
        capabilities: ["unit"],
        languages: ["js"],
        signers: [kid],
      },
      freshness: "head",
    };
    const r = await evaluatePolicy(att, policy, git);
    expect(r.passed).toBe(true);
  });

  it("fails an unsigned @2 attestation when a signer is required", async () => {
    const att = buildAttestationV2(record());
    const r = await evaluatePolicy(
      att,
      { require: { signers: ["*"] }, freshness: "off" },
      git,
    );
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("fails closed on a @2 signature with backend:cosign (not yet supported)", async () => {
    const att = buildAttestationV2(record());
    att.envelope.signatures.push({
      backend: "cosign",
      sig: "not-a-real-signature",
      cert: "not-a-real-cert",
    });
    const r = await evaluatePolicy(
      att,
      { require: { signers: ["*"] }, freshness: "off" },
      git,
    );
    const sigCheck = r.checks.find((c) => c.label === "signature");
    expect(sigCheck?.ok).toBe(false);
    expect(sigCheck?.reason).toMatch(/cosign verification not yet supported/);
  });

  it("rejects an untrusted @2 signer", async () => {
    const kp = generateKeyPair();
    const att = await signAttestationV2(
      buildAttestationV2(record()),
      kp.privateKeyPem,
    );
    const r = await evaluatePolicy(
      att,
      { require: { signers: ["deadbeef"] }, freshness: "off" },
      git,
    );
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
  });

  it("passes a @2 attestation with no policy.require.signers when --pubkey matches the signer", async () => {
    const kp = generateKeyPair();
    const att = await signAttestationV2(
      buildAttestationV2(record()),
      kp.privateKeyPem,
    );
    const kid = att.envelope.signatures[0]?.keyid;
    if (!kid) throw new Error("expected a signature");
    const r = await evaluatePolicy(
      att,
      { require: {}, freshness: "off" },
      git,
      { pubKeyId: kid },
    );
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(true);
    expect(r.passed).toBe(true);
  });

  it("fails a @2 attestation with no policy.require.signers when --pubkey does not match the signer", async () => {
    const kp = generateKeyPair();
    const att = await signAttestationV2(
      buildAttestationV2(record()),
      kp.privateKeyPem,
    );
    const r = await evaluatePolicy(
      att,
      { require: {}, freshness: "off" },
      git,
      { pubKeyId: "deadbeef" },
    );
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("displays the verifier-derived key id, not the attacker-claimed sig.keyid", async () => {
    const kp = generateKeyPair();
    const att = await signAttestationV2(
      buildAttestationV2(record()),
      kp.privateKeyPem,
    );
    const realKid = att.envelope.signatures[0]?.keyid;
    if (!realKid) throw new Error("expected a signature");
    // Tamper the claimed keyid on the signature; the cryptographic
    // recomputation inside the verifier must still be what gets displayed.
    const claimedSig = att.envelope.signatures[0];
    if (!claimedSig) throw new Error("expected a signature");
    claimedSig.keyid = "claimed-not-real";
    const r = await evaluatePolicy(
      att,
      { require: { signers: [realKid] }, freshness: "off" },
      git,
    );
    const sigCheck = r.checks.find((c) => c.label === "signature");
    expect(sigCheck?.ok).toBe(true);
    expect(sigCheck?.reason).toBe(`signed by ${realKid}`);
    expect(sigCheck?.reason).not.toContain("claimed-not-real");
  });

  it("SECURITY (@2 tamper): fails when the envelope payload is mutated after signing", async () => {
    const kp = generateKeyPair();
    const signed = await signAttestationV2(
      buildAttestationV2(record()),
      kp.privateKeyPem,
    );

    // Decode, tamper the predicate verdict WITHOUT recomputing the embedded
    // digest, re-encode — the original ed25519 signature (over the original
    // envelope bytes) is now stale either way.
    const stmt = JSON.parse(
      Buffer.from(signed.envelope.payload, "base64").toString("utf8"),
    );
    stmt.predicate.verdict.state = "failed";
    const tampered = {
      ...signed,
      envelope: {
        ...signed.envelope,
        payload: Buffer.from(JSON.stringify(stmt), "utf8").toString("base64"),
      },
    };

    const kid = signed.envelope.signatures[0]?.keyid;
    const r = await evaluatePolicy(
      tampered,
      { require: { signers: kid ? [kid] : ["*"] }, freshness: "off" },
      git,
    );
    expect(r.passed).toBe(false);
    // Either the integrity check (digest/canonical mismatch) or the
    // signature check (PAE no longer matches) must catch this — both are
    // acceptable, but at least one must fail.
    const integrity = r.checks.find((c) => c.label === "integrity");
    const signature = r.checks.find((c) => c.label === "signature");
    expect(integrity?.ok === false || signature?.ok === false).toBe(true);
  });

  it("matches the same subject/predicate whether read via @1 or @2 (attestationStatement parity)", async () => {
    const rec = record();
    const v1 = buildAttestation(rec);
    const v2 = buildAttestationV2(rec);
    expect(attestationStatement(v1).subject).toEqual(
      attestationStatement(v2).subject,
    );
  });
});

describe("evaluatePolicy — SECURITY regressions", () => {
  it("parser-differential: ignores a malicious `envelope` bolted onto a legitimately-signed @1 attestation", async () => {
    const kp = generateKeyPair();
    // Honestly-signed @1 statement — the real, digest-protected verdict is
    // FAILED, and the signature covers exactly that.
    const benign = signAttestation(
      buildAttestation(record({ state: "failed" })),
      kp.privateKeyPem,
    );
    if (!benign.signature) throw new Error("expected a signature");

    // Attacker crafts a favorable but forged statement (failed -> verified)
    // and bolts it on as `envelope`, hoping a heuristic reader treats
    // "has an envelope" as "read the @2 path" while the (still-valid)
    // signature check runs over the untouched, honestly-attested @1
    // `statement`.
    const maliciousStatement = {
      ...benign.statement,
      predicate: {
        ...benign.statement.predicate,
        verdict: { ...benign.statement.predicate.verdict, state: "verified" },
      },
    };
    const forged = {
      ...benign,
      envelope: {
        payloadType: "application/vnd.in-toto+json",
        payload: Buffer.from(
          JSON.stringify(maliciousStatement),
          "utf8",
        ).toString("base64"),
        signatures: [],
      },
    } as unknown as Attestation;

    // attestationStatement must return the SIGNED @1 statement (failed),
    // never the forged envelope's (verified).
    expect(attestationStatement(forged).predicate.verdict.state).toBe("failed");

    const kid = signatureKeyId(benign.signature);
    const r = await evaluatePolicy(
      forged,
      { require: { verdict: "verified", signers: [kid] }, freshness: "head" },
      git,
    );
    // The differential must not flip the verdict: gate correctly fails on
    // the real (failed) verdict instead of trusting the malicious envelope.
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.label === "verdict")?.ok).toBe(false);
  });

  it("throws (fails closed) on an attestation with an unknown schema — never guesses a format", async () => {
    const att = buildAttestation(record());
    const unknown = { ...att, schema: "veriskit/attestation@9" };
    await expect(evaluatePolicy(unknown, DEFAULT_POLICY, git)).rejects.toThrow(
      /unknown attestation schema/,
    );
  });
});

describe("loadPolicy / loadPolicyFile", () => {
  function tmpRoot(): string {
    return mkdtempSync(join(tmpdir(), "veris-policy-"));
  }

  it("returns DEFAULT_POLICY when .veris/policy.json is absent", async () => {
    const root = tmpRoot();
    await expect(loadPolicy(root)).resolves.toEqual(DEFAULT_POLICY);
  });

  it("rejects (fails closed) when .veris/policy.json exists but does not parse", async () => {
    const root = tmpRoot();
    mkdirSync(join(root, ".veris"), { recursive: true });
    writeFileSync(join(root, ".veris", "policy.json"), "{{{bad json");
    await expect(loadPolicy(root)).rejects.toThrow(/malformed/);
  });

  it("loadPolicyFile rejects when the named file is missing", async () => {
    const root = tmpRoot();
    await expect(loadPolicyFile(join(root, "nope.json"))).rejects.toThrow(
      /cannot read policy/,
    );
  });

  it("loadPolicyFile rejects when the named file does not parse", async () => {
    const root = tmpRoot();
    const path = join(root, "policy.json");
    writeFileSync(path, "not json");
    await expect(loadPolicyFile(path)).rejects.toThrow(/malformed/);
  });

  it("loadPolicyFile returns the parsed policy when valid", async () => {
    const root = tmpRoot();
    const path = join(root, "policy.json");
    writeFileSync(path, JSON.stringify(DEFAULT_POLICY));
    await expect(loadPolicyFile(path)).resolves.toEqual(DEFAULT_POLICY);
  });
});
