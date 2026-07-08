import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { biomeRunner } from "./biome.js";
import { eslintRunner } from "./eslint.js";
import { runners } from "./index.js";

const project = { root: "/tmp/x" } as Project;

describe("lint runners", () => {
  it("biome builds a check under the lint capability", () => {
    const c = biomeRunner.toCheck(project, {
      id: "lint",
      available: true,
      runner: "biome",
    } as Capability);
    expect(c.id).toBe("lint");
    expect(c.args.join(" ")).toContain("check");
  });
  it("eslint builds a check under the lint capability", () => {
    const c = eslintRunner.toCheck(project, {
      id: "lint",
      available: true,
      runner: "eslint",
    } as Capability);
    expect(c.id).toBe("lint");
  });
  it("registry exposes all six runners", () => {
    expect(Object.keys(runners).sort()).toEqual(
      ["biome", "eslint", "jest", "node-test", "tsc", "vitest"].sort(),
    );
  });
});
