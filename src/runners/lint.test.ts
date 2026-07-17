import { describe, expect, it } from "vitest";
import type { Project } from "../core/model.js";
import { biomeRunner } from "./biome.js";
import { eslintRunner } from "./eslint.js";
import { runners } from "./index.js";

const project = { root: "/tmp/x" } as Project;

describe("lint runners", () => {
  it("biome builds a check under the lint capability", () => {
    const c = biomeRunner.toCheck(project, {
      id: "lint",
      language: "js",
      available: true,
      runner: "biome",
    });
    expect(c.id).toBe("lint");
    expect(c.key).toBe("lint:js");
    expect(c.args.join(" ")).toContain("check");
  });
  it("eslint builds a check under the lint capability", () => {
    const c = eslintRunner.toCheck(project, {
      id: "lint",
      language: "js",
      available: true,
      runner: "eslint",
    });
    expect(c.id).toBe("lint");
    expect(c.key).toBe("lint:js");
  });
  it("registry exposes all fifteen runners", () => {
    expect(Object.keys(runners).sort()).toEqual(
      [
        "biome",
        "eslint",
        "flake8",
        "go-build",
        "go-test",
        "jest",
        "mypy",
        "node-test",
        "playwright",
        "pylint",
        "pytest",
        "pyright",
        "ruff",
        "tsc",
        "vitest",
      ].sort(),
    );
  });
});
