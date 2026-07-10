import { affectedChecks } from "../../affected/gate.js";
import { detectProject } from "../../config/detect.js";
import type { CapabilityId } from "../../core/model.js";
import { runChecks } from "../../core/orchestrator.js";
import { verdictExitCode } from "../../core/verdict.js";
import {
  createRunDir,
  writeMetadata,
  writeReport,
} from "../../evidence/store.js";
import { changedFiles } from "../../git/changes.js";
import { renderMarkdown } from "../../reporters/markdown.js";
import { renderRun } from "../../reporters/terminal.js";

export async function runAffected(
  root: string,
  opts: { base?: string; partialOk?: boolean } = {},
): Promise<number> {
  const project = await detectProject(root);
  const { files } = await changedFiles(root, { base: opts.base });
  const plan = affectedChecks(files, project);

  if (plan.checks.length === 0) {
    process.stdout.write(
      `Nothing affected — ${files.length} changed file(s), no checks to run.\n`,
    );
    return 0;
  }

  let targetFiles: Partial<Record<CapabilityId, string[]>> | undefined;
  let narrowedNote = "";
  const unitRunner = project.capabilities.find((c) => c.id === "unit")?.runner;
  const canNarrow = unitRunner === "vitest" || unitRunner === "jest";
  if (plan.checks.includes("unit") && canNarrow) {
    const { buildGraph } = await import("../../project-graph/graph.js");
    const { selectAffectedTests } = await import("../../affected/select.js");
    const graph = await buildGraph(project);
    const sel = selectAffectedTests(graph, files);
    if (sel.mode === "graph") {
      targetFiles = { unit: sel.testFiles };
      narrowedNote = `unit narrowed to ${sel.testFiles.length} of ${graph.testFiles.length} test file(s) via ${graph.resolver} graph`;
    } else {
      narrowedNote = `unit ran in full — ${sel.reason}`;
    }
  } else if (plan.checks.includes("unit") && unitRunner) {
    narrowedNote = `unit ran in full — the ${unitRunner} runner does not support file filtering`;
  }

  const run = await runChecks(project, plan.checks, root, { targetFiles });
  run.scope = { kind: "affected", changedCount: files.length };

  // Display-only: show available-but-unaffected capabilities as skipped.
  // The verdict was already computed over the affected set only.
  const affected = new Set(plan.checks);
  for (const cap of project.capabilities) {
    if (cap.available && cap.id !== "browser" && !affected.has(cap.id)) {
      run.results.push({
        checkId: cap.id,
        status: "skipped",
        durationMs: 0,
        summary: "not affected by changes",
      });
    }
  }

  const reportRef = await writeReport(root, run.id, renderMarkdown(run));
  run.reportRef = reportRef;
  const runDir = await createRunDir(root, run.id);
  await writeMetadata(runDir, run);

  process.stdout.write(`${renderRun(run)}\n`);
  if (narrowedNote) process.stdout.write(`${narrowedNote}\n`);
  return verdictExitCode(run.verdict, opts);
}
