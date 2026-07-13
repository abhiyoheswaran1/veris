import { describe, expect, it } from "vitest";
import type { CheckStatus } from "../core/model.js";
import type { EvidenceRecord } from "../evidence/record.js";
import { detectFlaky } from "./flaky.js";

function recWith(unit: CheckStatus): EvidenceRecord {
  return {
    schema: "veriskit/evidence@1",
    id: "x",
    startedAt: "t",
    tool: { name: "veriskit", version: "0.5.0" },
    git: null,
    env: { os: "x", node: "v24", pm: "npm", ci: false, timestamp: "t" },
    project: {
      name: "n",
      packageManager: "npm",
      frameworks: [],
      languages: [],
    },
    scope: { kind: "full", changedCount: 0 },
    checks: [{ id: "unit", status: unit, durationMs: 1, summary: "" }],
    verdict: {
      state: "verified",
      verifiedCapabilities: [],
      skipped: [],
      reasons: [],
    },
    digest: "sha256:0",
  };
}

describe("detectFlaky", () => {
  it("flags a check that both passed and failed", () => {
    const flaky = detectFlaky([
      recWith("passed"),
      recWith("failed"),
      recWith("passed"),
    ]);
    expect(flaky.map((f) => f.id)).toEqual(["unit"]);
  });
  it("does not flag an always-passing check", () => {
    expect(detectFlaky([recWith("passed"), recWith("passed")])).toEqual([]);
  });
  it("does not flag a skipped-only check", () => {
    expect(detectFlaky([recWith("skipped"), recWith("skipped")])).toEqual([]);
  });
});
