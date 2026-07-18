import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import {
  goBuildRunner,
  golangciLintRunner,
  goTestRunner,
  goVetRunner,
} from "./go.js";
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

describe("go lint runners", () => {
  it("golangci-lint builds a lint:go check running `golangci-lint run`", () => {
    const check = golangciLintRunner.toCheck(
      project,
      cap("lint", "golangci-lint"),
    );
    expect(check.key).toBe("lint:go");
    expect(check.cmd.endsWith("golangci-lint")).toBe(true);
    expect(check.args).toEqual(["run"]);
  });

  it("go-vet builds a lint:go check running `go vet ./...`", () => {
    const check = goVetRunner.toCheck(project, cap("lint", "go-vet"));
    expect(check.key).toBe("lint:go");
    expect(check.cmd.endsWith("go")).toBe(true);
    expect(check.args).toEqual(["vet", "./..."]);
  });

  it("every go runner name emitted by detection has a registered runner", () => {
    for (const name of ["go-test", "go-build", "golangci-lint", "go-vet"]) {
      expect(runners[name]).toBeDefined();
    }
  });
});
