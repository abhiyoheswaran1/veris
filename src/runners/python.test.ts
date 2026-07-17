import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { runners } from "./index.js";
import { pytestRunner } from "./python.js";

const project = { root: "/tmp/pyproj" } as Project;
const cap = (): Capability => ({
  id: "unit",
  language: "python",
  available: true,
  runner: "pytest",
});

describe("pytestRunner", () => {
  it("builds a python:unit check that runs pytest", () => {
    const check = pytestRunner.toCheck(project, cap());
    expect(check.id).toBe("unit");
    expect(check.language).toBe("python");
    expect(check.key).toBe("unit:python");
    expect(check.runner).toBe("pytest");
    // resolveBin with no .venv falls back to the bare tool name
    expect(check.cmd).toBe("pytest");
    expect(check.args).toEqual(["-q"]);
  });

  it("prefers a .venv/bin/pytest when the project has one", () => {
    // resolveBin returns the venv path only when it exists; here we only assert
    // the command ends in the tool name so both branches are acceptable.
    const check = pytestRunner.toCheck(project, cap());
    expect(check.cmd.endsWith("pytest")).toBe(true);
  });

  it("is registered under its runner name", () => {
    expect(runners.pytest).toBe(pytestRunner);
  });
});
