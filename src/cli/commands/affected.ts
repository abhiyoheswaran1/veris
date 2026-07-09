import { affectedChecks } from "../../affected/gate.js";
import { detectProject } from "../../config/detect.js";
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

  const run = await runChecks(project, plan.checks, root);
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
  return verdictExitCode(run.verdict, opts);
}
