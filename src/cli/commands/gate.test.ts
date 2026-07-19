import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAttest } from "./attest.js";
import { runGate } from "./gate.js";

// A real one-commit git repo whose HEAD matches the evidence commit. Mirrors
// the real project's .gitignore for `.veris/*` so these sandboxes behave like
// production: runs/evidence/reports/cache/keys never show up as untracked
// changes, only `.veris/attestations/` (deliberately not gitignored) does.
function repo(): { root: string; commit: string } {
  const root = mkdtempSync(join(tmpdir(), "veris-gate-"));
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
  run(["config", "user.email", "t@t.co"]);
  run(["config", "user.name", "t"]);
  run(["add", "."]);
  run(["commit", "-qm", "init"]);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
    .toString()
    .trim();
  return { root, commit };
}

describe("runGate", () => {
  it("passes after attest on a clean matching tree (default policy)", async () => {
    const { root } = repo();
    // rebuild the record with a correct digest via the real path:
    const { computeDigest } = await import("../../evidence/record.js");
    const runDir = join(root, ".veris", "runs", "r1");
    mkdirSync(runDir, { recursive: true });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
      .toString()
      .trim();
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

    expect(await runAttest(root)).toBe(0);
    expect(await runGate(root)).toBe(0);
  }, 30000);

  it("fails when no attestation exists", async () => {
    const { root } = repo();
    expect(await runGate(root)).toBe(1);
  }, 30000);

  it("fails freshness when a tracked, non-attestation .veris/ file (policy.json) is dirty", async () => {
    const { root } = repo();
    const { computeDigest } = await import("../../evidence/record.js");
    const run = (args: string[]) => execFileSync("git", args, { cwd: root });

    // Committed policy.json — tracked, and read live off disk by runGate.
    const policyPath = join(root, ".veris", "policy.json");
    mkdirSync(join(root, ".veris"), { recursive: true });
    writeFileSync(
      policyPath,
      JSON.stringify({ require: { verdict: "verified" }, freshness: "head" }),
    );
    run(["add", ".veris/policy.json"]);
    run(["commit", "-qm", "add policy"]);

    const runDir = join(root, ".veris", "runs", "r1");
    mkdirSync(runDir, { recursive: true });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
      .toString()
      .trim();
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

    // Clean tree at attest time (attestations/ isn't dirty until we write it).
    expect(await runAttest(root)).toBe(0);

    // Now dirty a TRACKED, non-attestation .veris/ file without committing —
    // this must NOT be exempted by the attestations-only carve-out.
    writeFileSync(
      policyPath,
      `${JSON.stringify({ require: { verdict: "verified" }, freshness: "head" })} `,
    );

    expect(await runGate(root)).toBe(1);
  }, 30000);

  it("fails closed (does not silently fall back to a permissive default) when .veris/policy.json exists but is malformed", async () => {
    const { root } = repo();
    const { computeDigest } = await import("../../evidence/record.js");
    const runDir = join(root, ".veris", "runs", "r1");
    mkdirSync(runDir, { recursive: true });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root })
      .toString()
      .trim();
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

    expect(await runAttest(root)).toBe(0);

    // Write a corrupt / merge-conflicted policy.json AFTER attest, so gate
    // is the thing reading it fresh off disk. Before the fix, a policy that
    // fails to parse silently fell back to DEFAULT_POLICY and this run would
    // have passed; it must now fail closed instead.
    mkdirSync(join(root, ".veris"), { recursive: true });
    writeFileSync(join(root, ".veris", "policy.json"), "{{{bad json");

    expect(await runGate(root)).toBe(1);
  }, 30000);
});
