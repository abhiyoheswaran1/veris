import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { buildRecord } from "./record.js";
import { verifyRecord } from "./verify-evidence.js";

function run(): VerificationRun {
  return {
    id: "r1",
    startedAt: "t",
    project: {
      root: "/x",
      name: "n",
      packageManager: "npm",
      frameworks: [],
      languages: [],
      scripts: {},
      capabilities: [{ id: "unit", available: true, runner: "vitest" }],
    },
    results: [
      { checkId: "unit", status: "passed", durationMs: 1, summary: "ok" },
    ],
    verdict: {
      state: "verified",
      verifiedCapabilities: ["unit"],
      skipped: [],
      reasons: [],
    },
    env: { os: "x", node: "v24", pm: "npm", ci: false, timestamp: "t" },
  };
}

describe("verifyRecord", () => {
  it("passes for an untouched record", () => {
    const result = verifyRecord(buildRecord(run(), null, {}, "0.4.0"));
    expect(result.ok).toBe(true);
    expect(result.kind).toBe("record");
  });

  it("fails when a field was edited after signing", () => {
    const rec = buildRecord(run(), null, {}, "0.4.0");
    rec.verdict.state = "failed"; // tamper, digest not recomputed
    const result = verifyRecord(rec);
    expect(result.ok).toBe(false);
    expect(result.checks.find((c) => c.name === "record digest")?.ok).toBe(
      false,
    );
  });
});
