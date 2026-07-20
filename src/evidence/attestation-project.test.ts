import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { attestProject } from "./attestation-project.js";

// A real one-commit git repo, mirroring the real project's .gitignore for
// `.veris/*` so these sandboxes behave like production.
function repo(): { root: string; commit: string } {
  const root = mkdtempSync(join(tmpdir(), "veris-attest-project-repo-"));
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

function writeEvidence(
  root: string,
  commit: string,
  id = "r1",
  opts: { dirty?: boolean } = {},
): void {
  const runDir = join(root, ".veris", "runs", id);
  mkdirSync(runDir, { recursive: true });
  const record = {
    schema: "veriskit/evidence@1",
    id,
    startedAt: "t",
    tool: { name: "veriskit", version: "0.6.1" },
    git: {
      commit,
      branch: "main",
      dirty: opts.dirty ?? false,
      changedFiles: opts.dirty ? 1 : 0,
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
    digest: "sha256:x",
  };
  writeFileSync(join(runDir, "evidence.json"), JSON.stringify(record));
}

describe("attestProject", () => {
  it("returns ok:true with path, subjectCommit, verdict for clean matching evidence", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    const outcome = await attestProject(root);
    expect(outcome.ok).toBe(true);
    expect(outcome.path).toBeTruthy();
    expect(outcome.subjectCommit).toBe(commit);
    expect(outcome.verdict).toBe("verified");
    expect(outcome.attestation?.statement.subject[0]?.digest.gitCommit).toBe(
      commit,
    );
    expect(outcome.attestation?.signature).toBeNull();
    expect(outcome.signerKeyId).toBeUndefined();
  }, 30000);

  it("returns ok:false with a dirty-tree error on a dirty tree", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    writeFileSync(join(root, "f.txt"), "changed\n");
    const outcome = await attestProject(root);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/dirty/);
  }, 30000);

  it("returns ok:false with a dirty-tree error when evidence recorded a dirty source at verify time, even if the tree is now clean (regression: attest must refuse a dirty-at-verify commit)", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit, "r1", { dirty: true });
    // Live tree is clean and HEAD matches — only the recorded evidence
    // says the source was dirty when verify ran.
    const outcome = await attestProject(root);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/dirty/);
  }, 30000);

  it("returns ok:false with a no-run error when there is no verification run", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-attest-project-empty-"));
    const outcome = await attestProject(root);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/no verification run/);
  });

  it("returns ok:false with a stale-evidence error when HEAD has advanced", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    const run = (args: string[]) => execFileSync("git", args, { cwd: root });
    writeFileSync(join(root, "f.txt"), "advanced\n");
    run(["commit", "-aqm", "advance"]);
    const outcome = await attestProject(root);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/re-run/);
  }, 30000);

  it("signs with the provided key file and reports signerKeyId", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    const { generateKeyPair } = await import("./signing.js");
    const kp = generateKeyPair();
    const keyPath = join(
      mkdtempSync(join(tmpdir(), "veris-attest-project-key-")),
      "key.pem",
    );
    writeFileSync(keyPath, kp.privateKeyPem);
    const outcome = await attestProject(root, { key: keyPath });
    expect(outcome.ok).toBe(true);
    expect(outcome.signerKeyId).toBe(kp.keyId);
    expect(outcome.attestation?.signature).not.toBeNull();
  }, 30000);
});
