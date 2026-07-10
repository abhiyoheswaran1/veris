import { describe, expect, it } from "vitest";
import type { ProjectGraph } from "../project-graph/model.js";
import { selectAffectedTests } from "./select.js";

const graph = {
  root: "/x",
  resolver: "typescript",
  sourceFiles: ["a.ts", "u.ts"],
  testFiles: ["a.test.ts"],
  nodes: {
    "a.ts": {
      file: "a.ts",
      kind: "source",
      imports: [],
      importedBy: ["a.test.ts"],
    },
    "u.ts": { file: "u.ts", kind: "source", imports: [], importedBy: [] },
    "a.test.ts": {
      file: "a.test.ts",
      kind: "test",
      imports: ["a.ts"],
      importedBy: [],
    },
  },
} as unknown as ProjectGraph;

describe("selectAffectedTests", () => {
  it("narrows to the test files reaching a changed source file", () => {
    const s = selectAffectedTests(graph, ["a.ts"]);
    expect(s.mode).toBe("graph");
    expect(s.testFiles).toEqual(["a.test.ts"]);
  });
  it("falls back to full on a config/global change", () => {
    expect(selectAffectedTests(graph, ["package.json"]).mode).toBe("full");
    expect(selectAffectedTests(graph, ["tsconfig.json"]).mode).toBe("full");
  });
  it("falls back to full on an unresolved changed file", () => {
    expect(selectAffectedTests(graph, ["not-in-graph.ts"]).mode).toBe("full");
  });
  it("falls back to full when the change has no reaching tests (untested)", () => {
    const s = selectAffectedTests(graph, ["u.ts"]);
    expect(s.mode).toBe("full");
    expect(s.reason).toContain("no tests");
  });
});
