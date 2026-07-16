import { describe, expect, it } from "vitest";
import type { Capability, CheckResult } from "./model.js";
import { computeVerdict, verdictExitCode } from "./verdict.js";

const caps: Capability[] = [
  { id: "types", language: "js", available: true, runner: "tsc" },
  { id: "unit", language: "js", available: true, runner: "vitest" },
  {
    id: "lint",
    language: "js",
    available: false,
    reason: "no linter configured",
  },
];

const res = (
  checkId: CheckResult["checkId"],
  status: CheckResult["status"],
): CheckResult => ({
  checkId,
  status,
  durationMs: 1,
  summary: "",
});

describe("computeVerdict", () => {
  it("failed when any check failed", () => {
    const v = computeVerdict(
      [res("types:js", "passed"), res("unit:js", "failed")],
      caps,
    );
    expect(v.state).toBe("failed");
    expect(verdictExitCode(v)).toBe(1);
  });

  it("partial when a capability was skipped/unavailable", () => {
    const v = computeVerdict(
      [res("types:js", "passed"), res("unit:js", "passed")],
      caps,
    );
    expect(v.state).toBe("partial");
    expect(v.skipped).toContain("lint:js");
    expect(verdictExitCode(v)).toBe(2);
    expect(verdictExitCode(v, { partialOk: true })).toBe(0);
  });

  it("verified only when all available capabilities passed and none skipped", () => {
    const allCaps: Capability[] = [
      { id: "types", language: "js", available: true, runner: "tsc" },
      { id: "unit", language: "js", available: true, runner: "vitest" },
    ];
    const v = computeVerdict(
      [res("types:js", "passed"), res("unit:js", "passed")],
      allCaps,
    );
    expect(v.state).toBe("verified");
    expect(verdictExitCode(v)).toBe(0);
  });

  it("partial when an available capability's runner is unregistered (skipped result)", () => {
    const availableCaps: Capability[] = [
      { id: "types", language: "js", available: true, runner: "tsc" },
      { id: "unit", language: "js", available: true, runner: "vitest" },
      { id: "lint", language: "js", available: true, runner: "biome" },
    ];
    const v = computeVerdict(
      [
        res("types:js", "passed"),
        res("unit:js", "passed"),
        {
          checkId: "lint:js",
          status: "skipped",
          durationMs: 0,
          summary: "no runner registered for biome",
        },
      ],
      availableCaps,
    );
    expect(v.state).toBe("partial");
    expect(v.skipped).toContain("lint:js");
    expect(v.verifiedCapabilities).not.toContain("lint:js");
  });

  it("partial when a requested capability outside the old CHECKED set is unavailable", () => {
    const v = computeVerdict(
      [],
      [
        {
          id: "browser",
          language: "js",
          available: false,
          reason: "deferred to v0.5",
        },
      ],
    );
    expect(v.state).toBe("partial");
    expect(v.skipped).toContain("browser:js");
  });

  it("partial when an available capability produced no result at all", () => {
    const availableCaps: Capability[] = [
      { id: "types", language: "js", available: true, runner: "tsc" },
      { id: "unit", language: "js", available: true, runner: "vitest" },
      { id: "lint", language: "js", available: true, runner: "biome" },
    ];
    const v = computeVerdict(
      [res("types:js", "passed"), res("unit:js", "passed")],
      availableCaps,
    );
    expect(v.state).toBe("partial");
    expect(v.skipped).toContain("lint:js");
  });
});
