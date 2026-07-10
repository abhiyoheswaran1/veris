import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Project } from "../core/model.js";
import { buildGraph } from "./graph.js";

const fx = fileURLToPath(
  new URL("../../test/fixtures/graph-basic", import.meta.url),
);
// Force the scanner path by pretending there's no tsconfig-based project TS:
const project = { root: fx, capabilities: [] } as unknown as Project;

describe("buildGraph (scanner)", () => {
  it("assembles nodes with imports + reverse importedBy edges", async () => {
    const g = await buildGraph(project);
    expect(["typescript", "scanner"]).toContain(g.resolver);
    // biome-ignore lint/style/noNonNullAssertion: fixture guarantees these nodes exist
    expect(g.nodes["b.ts"]!.imports).toContain("a.ts");
    // biome-ignore lint/style/noNonNullAssertion: fixture guarantees these nodes exist
    expect(g.nodes["a.ts"]!.importedBy).toContain("b.ts");
    // biome-ignore lint/style/noNonNullAssertion: fixture guarantees these nodes exist
    expect(g.nodes["a.ts"]!.importedBy).toContain("a.test.ts");
    expect(g.testFiles).toContain("a.test.ts");
    expect(g.sourceFiles).toEqual(expect.arrayContaining(["a.ts", "b.ts"]));
  });
});
