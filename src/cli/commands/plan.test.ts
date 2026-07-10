import { describe, expect, it } from "vitest";
import type { Project } from "../../core/model.js";
import type { ProjectGraph } from "../../project-graph/model.js";
import { renderPlan } from "./plan.js";

const project = {
  root: "/x",
  packageManager: "npm",
  frameworks: [],
  languages: [],
  scripts: {},
  capabilities: [
    { id: "lint", available: false, reason: "no linter configured" },
  ],
} as unknown as Project;
const graph = {
  resolver: "typescript",
  nodes: {},
  sourceFiles: [],
  testFiles: [],
} as unknown as ProjectGraph;

describe("renderPlan", () => {
  it("recommends untested high-impact files and flags weak verification", () => {
    const out = renderPlan(
      project,
      graph,
      {
        untested: ["src/core/x.ts"],
        blastRadius: { "src/core/x.ts": 12 },
        risky: [],
      },
      [],
    );
    expect(out.toLowerCase()).toContain("plan");
    expect(out).toContain("src/core/x.ts");
    expect(out).toContain("lint"); // weak verification surfaced
  });
});
