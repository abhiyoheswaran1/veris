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

describe("renderRun — cached results", () => {
  it("does not hide a cached failure behind a neutral glyph", () => {
    const cachedFailRun = {
      ...run,
      // overall verdict is "verified" so any ✗ found is unambiguously from
      // the per-check glyph, not the top-level verdict label
      verdict: {
        state: "verified",
        verifiedCapabilities: ["types"],
        skipped: [],
        reasons: [],
      },
      results: [
        {
          checkId: "types",
          status: "failed",
          durationMs: 300,
          summary: "no type errors",
          cached: true,
        },
      ],
    } as unknown as VerificationRun;
    const out = renderRun(cachedFailRun);
    const checkLine = out.split("\n").find((line) => line.includes("types"));
    expect(checkLine).toBeDefined();
    expect(checkLine).toContain("✗");
    expect(checkLine?.toLowerCase()).toContain("cached");
  });
});

describe("renderRun — affected scope", () => {
  it("uses affected wording and shows a not-affected check", () => {
    const run = {
      id: "a",
      startedAt: "2026-07-09T00:00:00.000Z",
      project: {
        root: "/x",
        packageManager: "npm",
        frameworks: [],
        languages: [],
        scripts: [],
        capabilities: [],
      },
      results: [
        {
          checkId: "types",
          status: "passed",
          durationMs: 300,
          summary: "no type errors",
        },
        {
          checkId: "lint",
          status: "skipped",
          durationMs: 0,
          summary: "not affected by changes",
        },
      ],
      verdict: {
        state: "verified",
        verifiedCapabilities: ["types"],
        skipped: [],
        reasons: [],
      },
      env: {
        os: "darwin",
        node: "v26",
        pm: "npm",
        ci: false,
        timestamp: "2026-07-09T00:00:00.000Z",
      },
      scope: { kind: "affected", changedCount: 2 },
    } as unknown as import("../core/model.js").VerificationRun;
    const out = renderRun(run);
    expect(out.toLowerCase()).toContain("affected");
    expect(out).toContain("2 changed");
    expect(out).toContain("not affected by changes");
    expect(out).not.toContain("✓ Verified"); // scoped wording, not bare Verified
  });
});
