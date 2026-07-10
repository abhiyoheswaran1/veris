import { detectProject } from "../../config/detect.js";
import { loadConfig } from "../../config/load.js";
import type { CapabilityId } from "../../core/model.js";
import { runChecks } from "../../core/orchestrator.js";
import { verdictExitCode } from "../../core/verdict.js";
import { buildRecord } from "../../evidence/record.js";
import {
  createRunDir,
  digestLogs,
  writeEvidence,
  writeReport,
} from "../../evidence/store.js";
import { gitAnchor } from "../../git/changes.js";
import { renderMarkdown } from "../../reporters/markdown.js";
import { renderRun } from "../../reporters/terminal.js";
import { VERSION } from "../../version.js";

const DEFAULT_CHECKS: CapabilityId[] = ["types", "lint", "unit"];

export async function runVerify(
  root: string,
  opts: { partialOk?: boolean } = {},
): Promise<number> {
  const project = await detectProject(root);
  const config = await loadConfig(root);
  const checks = config?.checks?.length ? config.checks : DEFAULT_CHECKS;
  const run = await runChecks(project, checks, root);

  const git = await gitAnchor(root);
  const logDigests = await digestLogs(run);
  const record = buildRecord(run, git, logDigests, VERSION);

  const reportRef = await writeReport(
    root,
    run.id,
    renderMarkdown(run, record),
  );
  run.reportRef = reportRef;
  const runDir = await createRunDir(root, run.id);
  await writeEvidence(runDir, record);

  process.stdout.write(`${renderRun(run, record)}\n`);
  return verdictExitCode(run.verdict, opts);
}
