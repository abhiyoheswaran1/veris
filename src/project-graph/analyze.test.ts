import { describe, expect, it } from "vitest";
import { analyze, transitiveDependents } from "./analyze.js";
import type { ProjectGraph } from "./model.js";

// a.ts <- b.ts <- b.test.ts ; c.ts has no test
const graph: ProjectGraph = {
  root: "/x",
  resolver: "scanner",
  sourceFiles: ["a.ts", "b.ts", "c.ts"],
  testFiles: ["b.test.ts"],
  nodes: {
    "a.ts": { file: "a.ts", kind: "source", imports: [], importedBy: ["b.ts"] },
    "b.ts": {
      file: "b.ts",
      kind: "source",
      imports: ["a.ts"],
      importedBy: ["b.test.ts"],
    },
    "c.ts": { file: "c.ts", kind: "source", imports: [], importedBy: [] },
    "b.test.ts": {
      file: "b.test.ts",
      kind: "test",
      imports: ["b.ts"],
      importedBy: [],
    },
  },
};

describe("analyze", () => {
  it("transitiveDependents walks reverse edges", () => {
    expect([...transitiveDependents(graph, "a.ts")].sort()).toEqual([
      "b.test.ts",
      "b.ts",
    ]);
  });
  it("marks source files no test reaches as untested (c.ts) and not a.ts/b.ts", () => {
    const { untested } = analyze(graph);
    expect(untested).toContain("c.ts");
    expect(untested).not.toContain("a.ts");
    expect(untested).not.toContain("b.ts");
  });
  it("blast radius counts transitive dependents", () => {
    const { blastRadius } = analyze(graph);
    expect(blastRadius["a.ts"]).toBe(2); // b.ts + b.test.ts
    expect(blastRadius["c.ts"]).toBe(0);
  });
  it("risky = high blast radius AND (untested OR changed)", () => {
    const { risky } = analyze(graph, ["a.ts"]);
    expect(risky).toContain("a.ts"); // changed + has dependents
  });
});
