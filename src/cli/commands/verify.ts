import { detectProject } from "../../config/detect.js";
import { loadConfig } from "../../config/load.js";
import type { CapabilityId, Project } from "../../core/model.js";
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
import { publishToGitHub } from "../../publish/publish.js";
import { renderMarkdown } from "../../reporters/markdown.js";
import { renderRun } from "../../reporters/terminal.js";
import { VERSION } from "../../version.js";

const DEFAULT_CHECKS: CapabilityId[] = ["types", "lint", "unit"];

export function resolveChecks(
  configChecks: CapabilityId[] | undefined,
  project: Project,
  opts: { browser?: boolean },
): CapabilityId[] {
  let checks = configChecks?.length ? configChecks : DEFAULT_CHECKS;
  if (opts.browser && !checks.includes("browser")) {
    const cap = project.capabilities.find((c) => c.id === "browser");
    if (cap?.available) checks = [...checks, "browser"];
  }
  return checks;
}

export async function runVerify(
  root: string,
  opts: { partialOk?: boolean; github?: boolean; browser?: boolean } = {},
): Promise<number> {
  const project = await detectProject(root);
  const config = await loadConfig(root);
  const checks = resolveChecks(config?.checks, project, opts);
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
  if (opts.github) await publishToGitHub(run, record);
  return verdictExitCode(run.verdict, opts);
}
