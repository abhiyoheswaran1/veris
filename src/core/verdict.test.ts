import { describe, expect, it } from "vitest";
import type { Capability, CheckResult } from "./model.js";
import { computeVerdict, verdictExitCode } from "./verdict.js";

const caps: Capability[] = [
  { id: "types", available: true, runner: "tsc" },
  { id: "unit", available: true, runner: "vitest" },
  { id: "lint", available: false, reason: "no linter configured" },
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
      [res("types", "passed"), res("unit", "failed")],
      caps,
    );
    expect(v.state).toBe("failed");
    expect(verdictExitCode(v)).toBe(1);
  });

  it("partial when a capability was skipped/unavailable", () => {
    const v = computeVerdict(
      [res("types", "passed"), res("unit", "passed")],
      caps,
    );
    expect(v.state).toBe("partial");
    expect(v.skipped).toContain("lint");
    expect(verdictExitCode(v)).toBe(2);
    expect(verdictExitCode(v, { partialOk: true })).toBe(0);
  });

  it("verified only when all available capabilities passed and none skipped", () => {
    const allCaps: Capability[] = [
      { id: "types", available: true, runner: "tsc" },
      { id: "unit", available: true, runner: "vitest" },
    ];
    const v = computeVerdict(
      [res("types", "passed"), res("unit", "passed")],
      allCaps,
    );
    expect(v.state).toBe("verified");
    expect(verdictExitCode(v)).toBe(0);
  });
});
