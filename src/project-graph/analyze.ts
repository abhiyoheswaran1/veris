import type { ProjectGraph } from "./model.js";

export interface Analysis {
  untested: string[];
  blastRadius: Record<string, number>;
  risky: string[];
}

export function transitiveDependents(
  graph: ProjectGraph,
  file: string,
): Set<string> {
  const seen = new Set<string>();
  const stack = [...(graph.nodes[file]?.importedBy ?? [])];
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    for (const d of graph.nodes[f]?.importedBy ?? []) stack.push(d);
  }
  return seen;
}

function reachableFromTests(graph: ProjectGraph): Set<string> {
  const seen = new Set<string>();
  const stack = [...graph.testFiles];
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    for (const i of graph.nodes[f]?.imports ?? []) stack.push(i);
  }
  return seen;
}

export function analyze(graph: ProjectGraph, changed: string[] = []): Analysis {
  const blastRadius: Record<string, number> = {};
  for (const file of Object.keys(graph.nodes)) {
    blastRadius[file] = transitiveDependents(graph, file).size;
  }
  const reached = reachableFromTests(graph);
  const byBlast = (a: string, b: string) =>
    (blastRadius[b] ?? 0) - (blastRadius[a] ?? 0);

  const untested = graph.sourceFiles
    .filter((f) => !reached.has(f))
    .sort(byBlast);

  const changedSet = new Set(changed);
  const untestedSet = new Set(untested);
  const risky = graph.sourceFiles
    .filter(
      (f) =>
        (blastRadius[f] ?? 0) > 0 && (untestedSet.has(f) || changedSet.has(f)),
    )
    .sort(byBlast);

  return { untested, blastRadius, risky };
}
