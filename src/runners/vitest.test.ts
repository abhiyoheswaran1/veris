import { mkdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { vitestRunner } from "./vitest.js";

const project = { root: "/tmp/x", packageManager: "npm" } as Project;
const cap: Capability = { id: "unit", available: true, runner: "vitest" };

beforeAll(() => {
  // spawn() requires cwd to exist even when the child command doesn't touch it.
  mkdirSync("/tmp/x", { recursive: true });
});

describe("vitestRunner", () => {
  it("builds a check invoking vitest run with json reporter", () => {
    const check = vitestRunner.toCheck(project, cap);
    expect(check.id).toBe("unit");
    expect(check.args).toContain("run");
    expect(check.args.join(" ")).toContain("json");
  });

  it("classifies a zero exit as passed", async () => {
    const result = await vitestRunner.run(
      {
        id: "unit",
        title: "Unit tests",
        runner: "vitest",
        cmd: process.execPath,
        args: ["-e", ""],
      },
      { root: "/tmp/x", runDir: "/tmp/x/.veris/runs/1" },
    );
    expect(result.status).toBe("passed");
  });
});
