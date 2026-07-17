import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { affectedChecks } from "./gate.js";

const project = (avail: Capability["id"][]): Project =>
  ({
    root: "/x",
    packageManager: "npm",
    frameworks: [],
    languages: [],
    scripts: {},
    capabilities: (["types", "lint", "unit", "browser"] as const).map((id) => ({
      id,
      language: "js" as const,
      available: avail.includes(id),
    })),
  }) as Project;

const P = project(["types", "lint", "unit"]);

describe("affectedChecks", () => {
  it("a .ts change affects types, lint, unit", () => {
    expect(affectedChecks(["src/x.ts"], P).checks).toEqual([
      "types",
      "lint",
      "unit",
    ]);
  });
  it("a docs-only change affects nothing", () => {
    expect(affectedChecks(["README.md"], P).checks).toEqual([]);
  });
  it("a config change affects all available capabilities", () => {
    expect(affectedChecks(["package.json"], P).checks).toEqual([
      "types",
      "lint",
      "unit",
    ]);
  });
  it("intersects with availability (no lint runner → no lint)", () => {
    const noLint = project(["types", "unit"]);
    expect(affectedChecks(["src/x.ts"], noLint).checks).toEqual([
      "types",
      "unit",
    ]);
  });
  it("an unknown code file conservatively affects all available", () => {
    expect(affectedChecks(["src/x.go"], P).checks).toEqual([
      "types",
      "lint",
      "unit",
    ]);
  });
  it("a test-only change affects unit + lint", () => {
    expect(affectedChecks(["src/x.test.ts"], P).checks).toEqual([
      "lint",
      "unit",
    ]);
  });
});
