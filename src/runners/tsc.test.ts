import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { tscRunner } from "./tsc.js";

describe("tscRunner", () => {
  it("builds a --noEmit check", () => {
    const check = tscRunner.toCheck(
      { root: "/tmp/x" } as Project,
      { id: "types", available: true, runner: "tsc" } as Capability,
    );
    expect(check.args).toContain("--noEmit");
    expect(check.id).toBe("types");
  });
});
