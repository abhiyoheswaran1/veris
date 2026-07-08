import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { vitestRunner } from "./vitest.js";

const project = { root: "/tmp/x", packageManager: "npm" } as Project;
const cap: Capability = { id: "unit", available: true, runner: "vitest" };

let runDir: string;

beforeAll(() => {
  // spawn() requires cwd to exist even when the child command doesn't touch it.
  runDir = mkdtempSync(join(tmpdir(), "veris-vitest-"));
});

describe("vitestRunner", () => {
  it("builds a check invoking vitest run with json reporter", () => {
    const check = vitestRunner.toCheck(project, cap);
    expect(check.id).toBe("unit");
    expect(check.args).toContain("run");
    expect(check.args.join(" ")).toContain("json");
    expect(check.cmd).toContain(join("node_modules", ".bin", "vitest"));
  });

  it("classifies a zero exit as passed and writes a log", async () => {
    const result = await vitestRunner.run(
      {
        id: "unit",
        title: "Unit tests",
        runner: "vitest",
        cmd: process.execPath,
        args: ["-e", ""],
      },
      { root: runDir, runDir },
    );
    expect(result.status).toBe("passed");
    expect(result.logRef).toBeTruthy();
    // logRef points at a real, readable file.
    expect(() => readFileSync(result.logRef as string, "utf8")).not.toThrow();
  });
});
