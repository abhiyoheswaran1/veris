import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";
import { detectProject } from "../../config/detect.js";
import { type Analysis, analyze } from "../../project-graph/analyze.js";
import { buildGraph } from "../../project-graph/graph.js";
import type { ProjectGraph } from "../../project-graph/model.js";
import { ensureDir } from "../../util/fs-safe.js";
import { isPlain } from "../tty.js";

export function renderScan(graph: ProjectGraph, analysis: Analysis): string {
  const plain = isPlain();
  const bold = (s: string) => (plain ? s : pc.bold(s));
  const dim = (s: string) => (plain ? s : pc.dim(s));
  const warn = (s: string) => (plain ? s : pc.yellow(s));
  const lines: string[] = [];
  lines.push(bold("Veris — scan"));
  lines.push("");
  lines.push(
    `Resolver    ${graph.resolver}${graph.resolver === "scanner" ? dim("  (no TypeScript found — relative imports only)") : ""}`,
  );
  lines.push(
    `Modules     ${Object.keys(graph.nodes).length}   ·  Source ${graph.sourceFiles.length}  ·  Tests ${graph.testFiles.length}`,
  );
  lines.push("");
  lines.push("Untested (top by impact)");
  const top = analysis.untested.slice(0, 10);
  if (top.length === 0)
    lines.push(dim("  none — every source file is reached by a test"));
  for (const f of top) {
    lines.push(
      `  ${warn("!")} ${f}   ${dim(`${analysis.blastRadius[f] ?? 0} dependents`)}`,
    );
  }
  return lines.join("\n");
}

export async function runScan(root: string): Promise<number> {
  const project = await detectProject(root);
  const graph = await buildGraph(project);
  const analysis = analyze(graph);

  const dir = join(root, ".veris");
  await ensureDir(dir);
  await writeFile(
    join(dir, "graph.json"),
    JSON.stringify({ resolver: graph.resolver, nodes: graph.nodes }, null, 2),
    "utf8",
  );

  process.stdout.write(`${renderScan(graph, analysis)}\n`);
  process.stdout.write(`\nGraph        ${join(".veris", "graph.json")}\n`);
  return 0;
}
