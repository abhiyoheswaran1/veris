import pc from "picocolors";
import { detectProject } from "../../config/detect.js";
import type { Project } from "../../core/model.js";
import { changedFiles } from "../../git/changes.js";
import { type Analysis, analyze } from "../../project-graph/analyze.js";
import { buildGraph } from "../../project-graph/graph.js";
import type { ProjectGraph } from "../../project-graph/model.js";
import { isPlain } from "../tty.js";

export function renderPlan(
  project: Project,
  graph: ProjectGraph,
  analysis: Analysis,
  changed: string[],
): string {
  const plain = isPlain();
  const bold = (s: string) => (plain ? s : pc.bold(s));
  const dim = (s: string) => (plain ? s : pc.dim(s));
  const warn = (s: string) => (plain ? s : pc.yellow(s));
  const lines: string[] = [];
  lines.push(bold("VerisKit — plan"));
  lines.push(dim(`(graph via ${graph.resolver})`));
  lines.push("");
  lines.push("Test these first (high impact, untested)");
  const top = analysis.untested.slice(0, 5);
  if (top.length === 0)
    lines.push(
      dim(
        "  none — untested files have no dependents or all files are covered",
      ),
    );
  top.forEach((f, i) => {
    lines.push(
      `  ${i + 1}. ${f}   ${dim(`(${analysis.blastRadius[f] ?? 0} dependents, no test reaches it)`)}`,
    );
  });
  lines.push("");
  lines.push("Verification setup");
  const weak = project.capabilities.filter(
    (c) => !c.available && c.id !== "browser",
  );
  if (weak.length === 0)
    lines.push(dim("  ✓ types, lint, and unit are all configured"));
  for (const c of weak)
    lines.push(
      `  ${warn("⚠")} ${c.id} capability unavailable — ${c.reason ?? "not configured"}`,
    );

  if (changed.length) {
    lines.push("");
    lines.push(`Risky changes (${changed.length} changed file(s))`);
    if (analysis.risky.length === 0) lines.push(dim("  none flagged"));
    for (const f of analysis.risky.slice(0, 8)) {
      const untested = analysis.untested.includes(f) ? ", untested" : "";
      lines.push(
        `  ${warn("!")} ${f}   ${dim(`${analysis.blastRadius[f] ?? 0} dependents${untested}`)}`,
      );
    }
  }
  lines.push("");
  lines.push(
    dim("Next: `veris affected` runs only the tests that reach your changes."),
  );
  return lines.join("\n");
}

export async function runPlan(
  root: string,
  opts: { base?: string } = {},
): Promise<number> {
  const project = await detectProject(root);
  const graph = await buildGraph(project);
  const { files } = await changedFiles(root, { base: opts.base });
  const analysis = analyze(graph, files);
  process.stdout.write(`${renderPlan(project, graph, analysis, files)}\n`);
  return 0;
}
