import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAttest } from "./attest.js";
import { runGate } from "./gate.js";

// A real one-commit git repo whose HEAD matches the evidence commit.
function repo(): { root: string; commit: string } {
  const root = mkdtempSync(join(tmpdir(), "veris-gate-"));
  const run = (args: string[]) => execFileSync("git", args, { cwd: root });
  writeFileSync(join(root, "f.txt"), "hi\n");
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
});
