import { transitiveDependents } from "../project-graph/analyze.js";
import type { ProjectGraph } from "../project-graph/model.js";

export interface TestSelection {
  mode: "graph" | "full";
  testFiles: string[];
  reason: string;
}

const GLOBAL_RE =
  /(^|\/)(tsconfig[^/]*\.json|package\.json|biome\.jsonc?|\.eslintrc[^/]*|eslint\.config\.[^/]+|veris\.config\.[^/]+|[^/]+\.config\.[cm]?[jt]sx?|[^/]+\.setup\.[cm]?[jt]sx?)$/;

export function selectAffectedTests(
  graph: ProjectGraph,
  changed: string[],
): TestSelection {
  if (graph.resolver !== "typescript") {
    return {
      mode: "full",
      testFiles: [],
      reason:
        "scanner graph can miss aliased/subpath imports — running the full suite",
    };
  }
  for (const f of changed) {
    if (GLOBAL_RE.test(f)) {
      return {
        mode: "full",
        testFiles: [],
        reason: `global/config change (${f})`,
      };
    }
    if (!(f in graph.nodes)) {
      return {
        mode: "full",
        testFiles: [],
        reason: `unresolved changed file (${f})`,
      };
    }
  }
  const tests = new Set<string>();
  for (const f of changed) {
    if (graph.nodes[f]?.kind === "test") tests.add(f);
    for (const dep of transitiveDependents(graph, f)) {
      if (graph.nodes[dep]?.kind === "test") tests.add(dep);
    }
  }
  if (tests.size === 0) {
    return {
      mode: "full",
      testFiles: [],
      reason: "no tests reach the changed files",
    };
  }
  const selected = [...tests].sort();
  if (selected.some((t) => t.startsWith("-"))) {
    return {
      mode: "full",
      testFiles: [],
      reason: "a reaching test path starts with '-' (unsafe as a CLI argument)",
    };
  }
  return { mode: "graph", testFiles: selected, reason: "" };
}
