import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { latestAttestation } from "../../evidence/store.js";
import { runAttest } from "./attest.js";

// A real one-commit git repo, mirroring the real project's .gitignore for
// `.veris/*` so these sandboxes behave like production: runs/evidence never
// show up as untracked changes, only `.veris/attestations/` (deliberately
// not gitignored) does.
function repo(): { root: string; commit: string } {
  const root = mkdtempSync(join(tmpdir(), "veris-attest-repo-"));
  const run = (args: string[]) => execFileSync("git", args, { cwd: root });
  writeFileSync(join(root, "f.txt"), "hi\n");
  writeFileSync(
    join(root, ".gitignore"),
    [
      ".veris/runs",
      ".veris/reports",
      ".veris/cache",
      ".veris/evidence",
      ".veris/keys",
      ".veris/graph.json",
      "",
    ].join("\n"),
  );
  run(["init", "-q"]);
  run(["config", "user.email", "t@t.dev"]);
  run(["config", "user.name", "t"]);
  run(["add", "."]);
  run(["commit", "-qm", "init"]);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
    .toString()
    .trim();
  return { root, commit };
}

function writeEvidence(root: string, commit: string, id = "r1"): void {
  const runDir = join(root, ".veris", "runs", id);
  mkdirSync(runDir, { recursive: true });
  const record = {
    schema: "veriskit/evidence@1",
    id,
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
}

describe("runAttest", () => {
  it("writes an unsigned attestation for a clean tree", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    const code = await runAttest(root);
    expect(code).toBe(0);
    const found = latestAttestation(root);
    expect(found?.att.statement.subject[0]?.digest.gitCommit).toBe(commit);
    expect(found?.att.signature).toBeNull();
  }, 30000);

  it("refuses a dirty tree", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    writeFileSync(join(root, "f.txt"), "changed\n");
    expect(await runAttest(root)).toBe(1);
    expect(latestAttestation(root)).toBeNull();
  }, 30000);

  it("errors when there is no verification run", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-attest-empty-"));
    expect(await runAttest(root)).toBe(1);
  });

  it("signs when VERISKIT_SIGNING_KEY is set", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    const { generateKeyPair } = await import("../../evidence/signing.js");
    const kp = generateKeyPair();
    const prev = process.env.VERISKIT_SIGNING_KEY;
    process.env.VERISKIT_SIGNING_KEY = kp.privateKeyPem;
    try {
      expect(await runAttest(root)).toBe(0);
      expect(latestAttestation(root)?.att.signature).not.toBeNull();
    } finally {
      if (prev === undefined) delete process.env.VERISKIT_SIGNING_KEY;
      else process.env.VERISKIT_SIGNING_KEY = prev;
    }
  }, 30000);

  it("succeeds when a prior untracked attestation exists but the source tree matches HEAD", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    // First attest leaves an untracked .veris/attestations/r1.att.json.
    expect(await runAttest(root)).toBe(0);
    // Re-attesting off the same (still-current) evidence must still
    // succeed — the prior attestation output must not itself count as
    // dirty.
    expect(await runAttest(root)).toBe(0);
  }, 30000);

  it("refuses when the evidence commit is stale relative to current HEAD", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    // Advance HEAD past the commit the evidence was captured for.
    const run = (args: string[]) => execFileSync("git", args, { cwd: root });
    writeFileSync(join(root, "f.txt"), "advanced\n");
    run(["commit", "-aqm", "advance"]);
    const code = await runAttest(root);
    expect(code).toBe(1);
    expect(latestAttestation(root)).toBeNull();
  }, 30000);
});
