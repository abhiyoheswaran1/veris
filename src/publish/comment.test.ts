import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { MARKER, renderComment } from "./comment.js";

const run: VerificationRun = {
  id: "r1",
  startedAt: "2026-07-13T00:00:00.000Z",
  project: {
    root: "/x",
    packageManager: "npm",
    frameworks: [],
    languages: [],
    scripts: {},
    capabilities: [],
  },
  results: [
    { checkId: "unit", status: "passed", durationMs: 1000, summary: "ok" },
  ],
  verdict: {
    state: "verified",
    verifiedCapabilities: ["unit"],
    skipped: [],
    reasons: [],
  },
  env: { os: "x", node: "v24", pm: "npm", ci: true, timestamp: "t" },
};

describe("renderComment", () => {
  it("starts with the marker and shows the verdict inside a details block", () => {
    const body = renderComment(run);
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body).toContain("VerisKit: verified");
    expect(body).toContain("<details>");
  });
});
