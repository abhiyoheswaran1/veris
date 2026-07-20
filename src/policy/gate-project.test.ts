import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { attestProject } from "../evidence/attestation-project.js";
import { computeDigest } from "../evidence/record.js";
import { gateProject } from "./gate-project.js";

// A real one-commit git repo, mirroring the real project's .gitignore for
// `.veris/*` so these sandboxes behave like production.
function repo(): { root: string; commit: string } {
  const root = mkdtempSync(join(tmpdir(), "veris-gate-project-repo-"));
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
  const base = {
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
  };
  writeFileSync(
    join(runDir, "evidence.json"),
    JSON.stringify({ ...base, digest: computeDigest(base) }),
  );
}

describe("gateProject", () => {
  it("passes on a clean matching verified attestation", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    const att = await attestProject(root);
    expect(att.ok).toBe(true);

    const outcome = await gateProject(root);
    expect(outcome.ok).toBe(true);
    expect(outcome.result?.passed).toBe(true);
    expect(outcome.attestationPath).toBeTruthy();
  }, 30000);

  it("returns ok:false with an error when there is no attestation", async () => {
    const { root } = repo();
    const outcome = await gateProject(root);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/no attestation found/);
    expect(outcome.result).toBeUndefined();
  }, 30000);

  it("returns result.passed:false when HEAD has advanced past the attested commit", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    const att = await attestProject(root);
    expect(att.ok).toBe(true);

    const run = (args: string[]) => execFileSync("git", args, { cwd: root });
    writeFileSync(join(root, "f.txt"), "advanced\n");
    run(["add", "f.txt"]);
    run(["commit", "-qm", "advance"]);

    const outcome = await gateProject(root);
    expect(outcome.ok).toBe(true);
    expect(outcome.result?.passed).toBe(false);
    const freshness = outcome.result?.checks.find(
      (c) => c.label === "freshness",
    );
    expect(freshness?.ok).toBe(false);
  }, 30000);

  it("fails closed with a malformed error on a corrupt policy file", async () => {
    const { root, commit } = repo();
    writeEvidence(root, commit);
    const att = await attestProject(root);
    expect(att.ok).toBe(true);

    mkdirSync(join(root, ".veris"), { recursive: true });
    writeFileSync(join(root, ".veris", "policy.json"), "{{{bad json");

    const outcome = await gateProject(root);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/malformed/);
    expect(outcome.result).toBeUndefined();
  }, 30000);
});
