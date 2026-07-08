import { detectProject } from "../../config/detect.js";
import { loadConfig } from "../../config/load.js";
import type { CapabilityId } from "../../core/model.js";
import { runChecks } from "../../core/orchestrator.js";
import { verdictExitCode } from "../../core/verdict.js";
import {
  createRunDir,
  writeMetadata,
  writeReport,
} from "../../evidence/store.js";
import { renderMarkdown } from "../../reporters/markdown.js";
import { renderRun } from "../../reporters/terminal.js";

const DEFAULT_CHECKS: CapabilityId[] = ["types", "lint", "unit"];

export async function runVerify(
  root: string,
  opts: { partialOk?: boolean } = {},
): Promise<number> {
  const project = await detectProject(root);
  const config = await loadConfig(root);
  const checks = config?.checks?.length ? config.checks : DEFAULT_CHECKS;
  const run = await runChecks(project, checks, root);

  const reportRef = await writeReport(root, run.id, renderMarkdown(run));
  run.reportRef = reportRef;
  const runDir = await createRunDir(root, run.id);
  await writeMetadata(runDir, run);

  process.stdout.write(`${renderRun(run)}\n`);
  return verdictExitCode(run.verdict, opts);
}
