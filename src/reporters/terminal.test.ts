import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { renderRun } from "./terminal.js";

const run: VerificationRun = {
  id: "abc",
  startedAt: "2026-07-08T00:00:00.000Z",
  project: {
    root: "/x",
    packageManager: "npm",
    frameworks: [],
    languages: ["typescript"],
    scripts: {},
    capabilities: [],
  },
  results: [
    {
      checkId: "types",
      status: "passed",
      durationMs: 4200,
      summary: "no type errors",
    },
    {
      checkId: "unit",
      status: "failed",
      durationMs: 1200,
      summary: "unit tests failed",
      outputTail: "FAIL src/a.test.ts\nexpected 1 to be 2",
    },
    {
      checkId: "lint",
      status: "skipped",
      durationMs: 0,
      summary: "no linter configured",
    },
  ],
  verdict: {
    state: "failed",
    verifiedCapabilities: ["types"],
    skipped: ["lint"],
    reasons: ["lint skipped — no linter configured"],
  },
  env: {
    os: "darwin",
    node: "v26.0.0",
    pm: "npm",
    ci: false,
    timestamp: "2026-07-08T00:00:00.000Z",
  },
};

describe("renderRun", () => {
  it("shows each check, the verdict, and the skip reason", () => {
    const out = renderRun(run);
    expect(out).toContain("types");
    expect(out).toContain("lint");
    expect(out).toContain("skipped");
    expect(out.toLowerCase()).toContain("failed");
  });

  it("surfaces a failed check's outputTail inline", () => {
    const out = renderRun(run);
    expect(out).toContain("FAIL src/a.test.ts");
    expect(out).toContain("expected 1 to be 2");
  });
});
