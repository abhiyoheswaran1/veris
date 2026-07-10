import { describe, expect, it } from "vitest";
import type { ProjectGraph } from "../../project-graph/model.js";
import { renderScan } from "./scan.js";

const graph = {
  root: "/x",
  resolver: "typescript",
  sourceFiles: ["a.ts", "c.ts"],
  testFiles: ["a.test.ts"],
  nodes: {
    "a.ts": {
      file: "a.ts",
      kind: "source",
      imports: [],
      importedBy: ["a.test.ts"],
    },
    "c.ts": { file: "c.ts", kind: "source", imports: [], importedBy: [] },
    "a.test.ts": {
      file: "a.test.ts",
      kind: "test",
      imports: ["a.ts"],
      importedBy: [],
    },
  },
} as unknown as ProjectGraph;

describe("renderScan", () => {
  it("shows the resolver, counts, and untested files", () => {
    const out = renderScan(graph, {
      untested: ["c.ts"],
      blastRadius: { "c.ts": 0 },
      risky: [],
    });
    expect(out.toLowerCase()).toContain("scan");
    expect(out).toContain("typescript");
    expect(out).toContain("c.ts");
  });
});
