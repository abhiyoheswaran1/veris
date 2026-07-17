import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { goBuildRunner, goTestRunner } from "./go.js";
import { runners } from "./index.js";

const project = { root: "/tmp/goproj" } as Project;
const cap = (id: "unit" | "types" | "lint", runner: string): Capability => ({
  id,
  language: "go",
  available: true,
  runner,
});

describe("goTestRunner", () => {
  it("builds a unit:go check that runs `go test ./...`", () => {
    const check = goTestRunner.toCheck(project, cap("unit", "go-test"));
    expect(check.id).toBe("unit");
    expect(check.language).toBe("go");
    expect(check.key).toBe("unit:go");
    expect(check.runner).toBe("go-test");
    expect(check.cmd.endsWith("go")).toBe(true);
    expect(check.args).toEqual(["test", "./..."]);
  });

  it("is registered under go-test", () => {
    expect(runners["go-test"]).toBe(goTestRunner);
  });
});

describe("goBuildRunner", () => {
  it("builds a types:go check that runs `go build ./...`", () => {
    const check = goBuildRunner.toCheck(project, cap("types", "go-build"));
    expect(check.key).toBe("types:go");
    expect(check.cmd.endsWith("go")).toBe(true);
    expect(check.args).toEqual(["build", "./..."]);
  });

  it("is registered under go-build", () => {
    expect(runners["go-build"]).toBe(goBuildRunner);
  });
});
