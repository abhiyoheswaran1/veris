import { afterEach, describe, expect, it, vi } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { publishToGitHub } from "./publish.js";

const run = {
  id: "r1",
  startedAt: "t",
  project: {
    root: "/x",
    packageManager: "npm",
    frameworks: [],
    languages: [],
    scripts: [],
    capabilities: [],
  },
  results: [],
  verdict: {
    state: "verified",
    verifiedCapabilities: [],
    skipped: [],
    reasons: [],
  },
  env: { os: "x", node: "v24", pm: "npm", ci: true, timestamp: "t" },
} as unknown as VerificationRun;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("publishToGitHub", () => {
  it("prints a notice and does not throw when there is no context", async () => {
    for (const k of [
      "GITHUB_REPOSITORY",
      "GITHUB_TOKEN",
      "GITHUB_REF",
      "GITHUB_EVENT_PATH",
    ]) {
      vi.stubEnv(k, "");
    }
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await expect(publishToGitHub(run)).resolves.toBeUndefined();
    expect(out.mock.calls.join("")).toContain("skipping publish");
  });
});
