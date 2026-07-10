import type { Project } from "../core/model.js";
import { discoverFiles } from "./discover.js";
import type { ModuleNode, ProjectGraph } from "./model.js";
import { selectResolver } from "./ts-resolver.js";

export async function buildGraph(project: Project): Promise<ProjectGraph> {
  const root = project.root;
  const files = discoverFiles(root);
  const known = new Set(files.map((f) => f.file));

  // selectResolver returns { resolver, importsOf } — scanner or typescript.
  const { resolver, importsOf } = selectResolver(root);

  const nodes: Record<string, ModuleNode> = {};
  for (const f of files) {
    nodes[f.file] = { file: f.file, kind: f.kind, imports: [], importedBy: [] };
  }
  for (const f of files) {
    const imps = importsOf(f.file).filter((i) => known.has(i) && i !== f.file);
    // biome-ignore lint/style/noNonNullAssertion: f.file was just seeded into nodes above
    nodes[f.file]!.imports = imps;
    for (const i of imps) nodes[i]?.importedBy.push(f.file);
  }

  return {
    root,
    resolver,
    nodes,
    sourceFiles: files.filter((f) => f.kind === "source").map((f) => f.file),
    testFiles: files.filter((f) => f.kind === "test").map((f) => f.file),
  };
}
