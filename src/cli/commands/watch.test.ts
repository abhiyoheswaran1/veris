import { describe, expect, it } from "vitest";
import type { Capability, CheckResult, Project } from "../../core/model.js";
import { computeVerdict } from "../../core/verdict.js";
import { buildWatchResults } from "./watch.js";

const project = {
  root: "/x",
  packageManager: "npm",
  frameworks: [],
  languages: [],
  scripts: {},
  capabilities: (["types", "lint", "unit"] as const).map((id) => ({
    id,
    language: "js",
    available: true,
  })) as Capability[],
} as Project;

describe("buildWatchResults", () => {
  it("returns fresh results for affected and cached for the rest", () => {
    const fresh: CheckResult[] = [
      {
        checkId: "unit:js",
        status: "passed",
        durationMs: 1200,
        summary: "unit tests passed",
      },
    ];
    const cache = new Map<string, CheckResult>([
      [
        "types:js",
        {
          checkId: "types:js",
          status: "passed",
          durationMs: 300,
          summary: "no type errors",
        },
      ],
    ]);
    const out = buildWatchResults(project, ["unit"], fresh, cache);
    const byId = Object.fromEntries(out.map((r) => [r.checkId, r]));
    expect(byId["unit:js"]?.cached).toBeFalsy();
    expect(byId["types:js"]?.cached).toBe(true);
    // lint has neither fresh nor cache → shown as skipped "not affected"
    expect(byId["lint:js"]?.status).toBe("skipped");
    expect(byId["lint:js"]?.summary).toContain("not affected");
  });
});

describe("watch tick verdict", () => {
  it("keeps the verdict failed when a cached check is still broken, even though this tick's affected checks passed", () => {
    const twoCapProject = {
      ...project,
      capabilities: (["types", "unit"] as const).map((id) => ({
        id,
        language: "js",
        available: true,
      })) as Capability[],
    } as Project;
    const fresh: CheckResult[] = [
      {
        checkId: "unit:js",
        status: "passed",
        durationMs: 500,
        summary: "unit tests passed",
      },
    ];
    const cache = new Map<string, CheckResult>([
      [
        "types:js",
        {
          checkId: "types:js",
          status: "failed",
          durationMs: 300,
          summary: "type error in src/a.ts",
        },
      ],
    ]);
    const results = buildWatchResults(twoCapProject, ["unit"], fresh, cache);
    const availableCaps = twoCapProject.capabilities.filter(
      (c) => c.available && c.id !== "browser",
    );
    const verdict = computeVerdict(results, availableCaps);
    expect(verdict.state).toBe("failed");
  });
});
