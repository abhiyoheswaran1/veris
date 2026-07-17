import { describe, expect, it } from "vitest";
import type { Project } from "../../core/model.js";
import { resolveChecks } from "../../core/orchestrate.js";

function project(browserAvailable: boolean): Project {
  return {
    root: "/x",
    packageManager: "npm",
    frameworks: [],
    languages: [],
    scripts: {},
    capabilities: [
      { id: "unit", language: "js", available: true, runner: "vitest" },
      {
        id: "browser",
        language: "js",
        available: browserAvailable,
        runner: "playwright",
      },
    ],
  };
}

describe("resolveChecks", () => {
  it("uses the default set when no config and no --browser", () => {
    expect(resolveChecks(undefined, project(true), {})).toEqual([
      "types",
      "lint",
      "unit",
    ]);
  });
  it("appends browser with --browser when available", () => {
    expect(
      resolveChecks(undefined, project(true), { browser: true }),
    ).toContain("browser");
  });
  it("does not append browser when it is unavailable", () => {
    expect(
      resolveChecks(undefined, project(false), { browser: true }),
    ).not.toContain("browser");
  });
  it("honors a config check list", () => {
    expect(resolveChecks(["unit"], project(true), {})).toEqual(["unit"]);
  });
});
