import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { latestAttestation } from "../../evidence/store.js";
import { runAttest } from "./attest.js";

function repoWithEvidence(dirty: boolean, commit = "a".repeat(40)): string {
  const root = mkdtempSync(join(tmpdir(), "veris-attest-"));
  const runDir = join(root, ".veris", "runs", "2026-01-01T00-00-00-1");
  mkdirSync(runDir, { recursive: true });
  const record = {
    schema: "veriskit/evidence@1",
    id: "2026-01-01T00-00-00-1",
    startedAt: "t",
    tool: { name: "veriskit", version: "0.6.1" },
    git: { commit, branch: "main", dirty, changedFiles: dirty ? 1 : 0 },
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
    digest: "sha256:x",
  };
  writeFileSync(join(runDir, "evidence.json"), JSON.stringify(record));
  return root;
}

describe("runAttest", () => {
  it("writes an unsigned attestation for a clean tree", async () => {
    const root = repoWithEvidence(false);
    const code = await runAttest(root);
    expect(code).toBe(0);
    const found = latestAttestation(root);
    expect(found?.att.statement.subject[0]?.digest.gitCommit).toBe(
      "a".repeat(40),
    );
    expect(found?.att.signature).toBeNull();
  });

  it("refuses a dirty tree", async () => {
    const root = repoWithEvidence(true);
    expect(await runAttest(root)).toBe(1);
    expect(latestAttestation(root)).toBeNull();
  });

  it("errors when there is no verification run", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-attest-empty-"));
    expect(await runAttest(root)).toBe(1);
  });

  it("signs when VERISKIT_SIGNING_KEY is set", async () => {
    const root = repoWithEvidence(false);
    const { generateKeyPair } = await import("../../evidence/signing.js");
    const kp = generateKeyPair();
    const prev = process.env.VERISKIT_SIGNING_KEY;
    process.env.VERISKIT_SIGNING_KEY = kp.privateKeyPem;
    try {
      expect(await runAttest(root)).toBe(0);
      expect(latestAttestation(root)?.att.signature).not.toBeNull();
    } finally {
      process.env.VERISKIT_SIGNING_KEY = prev;
    }
  });
});
