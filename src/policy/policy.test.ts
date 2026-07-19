import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAttestation, signAttestation } from "../evidence/attestation.js";
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

describe("evaluatePolicy", () => {
  it("passes a signed, fresh, verified attestation meeting coverage", () => {
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
    const r = evaluatePolicy(att, policy, git);
    expect(r.passed).toBe(true);
  });

  it("fails on a tampered predicate (integrity)", () => {
    const att = buildAttestation(record());
    att.statement.predicate.verdict.state = "failed"; // digest no longer matches
    const r = evaluatePolicy(att, DEFAULT_POLICY, git);
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.label === "integrity")?.ok).toBe(false);
  });

  it("fails a stale commit (freshness)", () => {
    const att = buildAttestation(record({}, "b".repeat(40)));
    const r = evaluatePolicy(att, DEFAULT_POLICY, git);
    expect(r.checks.find((c) => c.label === "freshness")?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("fails a dirty tree (freshness)", () => {
    const att = buildAttestation(record());
    const r = evaluatePolicy(att, DEFAULT_POLICY, {
      commit: COMMIT,
      dirty: true,
    });
    expect(r.checks.find((c) => c.label === "freshness")?.ok).toBe(false);
  });

  it("fails a partial verdict under require verified, passes under partial-ok", () => {
    const att = buildAttestation(record({ state: "partial" }));
    expect(
      evaluatePolicy(
        att,
        { require: { verdict: "verified" }, freshness: "off" },
        git,
      ).passed,
    ).toBe(false);
    expect(
      evaluatePolicy(
        att,
        { require: { verdict: "partial-ok" }, freshness: "off" },
        git,
      ).passed,
    ).toBe(true);
  });

  it("fails when a required capability×language is not verified", () => {
    const att = buildAttestation(record());
    const r = evaluatePolicy(
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

  it("requires a valid signature when signers is set; unsigned fails", () => {
    const att = buildAttestation(record()); // unsigned
    const r = evaluatePolicy(
      att,
      { require: { signers: ["*"] }, freshness: "off" },
      git,
    );
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
  });

  it("rejects an untrusted signer", () => {
    const kp = generateKeyPair();
    const att = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    const r = evaluatePolicy(
      att,
      { require: { signers: ["deadbeef"] }, freshness: "off" },
      git,
    );
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
  });

  it("rejects a forged subject that no longer matches the digest-protected evidence commit", () => {
    // Unsigned attestation whose real (digest-protected) evidence is for a
    // stale commit. An attacker edits ONLY the subject (which lives outside
    // the predicate digest) to point at current HEAD.
    const att = buildAttestation(record({}, "b".repeat(40)));
    const subject = att.statement.subject[0];
    if (subject) subject.digest.gitCommit = COMMIT;
    const r = evaluatePolicy(att, DEFAULT_POLICY, git);
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.label === "integrity")?.ok).toBe(false);
  });

  it("matches a capability-only requirement against composite verifiedCapabilities keys", () => {
    const att = buildAttestation(record());
    const r = evaluatePolicy(
      att,
      { require: { capabilities: ["unit"] }, freshness: "off" },
      git,
    );
    expect(r.passed).toBe(true);
  });

  it("treats a lone string signer as an exact-match single-element list, not a substring match", () => {
    const kp = generateKeyPair();
    const att = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    if (!att.signature) throw new Error("expected a signature");
    const kid = signatureKeyId(att.signature);

    // Hand-edited policy where `signers` is a bare string, not an array.
    const policy = {
      require: { signers: kid as unknown as string[] },
      freshness: "off",
    } satisfies Policy;
    expect(evaluatePolicy(att, policy, git).passed).toBe(true);

    // A different id must NOT pass just because it shares characters with kid.
    const otherPolicy = {
      require: { signers: `x${kid}` as unknown as string[] },
      freshness: "off",
    } satisfies Policy;
    expect(evaluatePolicy(att, otherPolicy, git).passed).toBe(false);
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
