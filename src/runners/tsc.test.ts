import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Project } from "../core/model.js";
import { tscRunner } from "./tsc.js";

describe("tscRunner", () => {
  it("builds a --noEmit check", () => {
    const check = tscRunner.toCheck({ root: "/tmp/x" } as Project, {
      id: "types",
      language: "js",
      available: true,
      runner: "tsc",
    });
    expect(check.args).toContain("--noEmit");
    expect(check.id).toBe("types");
    expect(check.key).toBe("types:js");
    expect(check.cmd).toContain(join("node_modules", ".bin", "tsc"));
  });
});
