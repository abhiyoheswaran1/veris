import { detectProject } from "../../config/detect.js";
import { runChecks } from "../../core/orchestrator.js";
import { verdictExitCode } from "../../core/verdict.js";
import { renderRun } from "../../reporters/terminal.js";

export async function runTest(root: string): Promise<number> {
  const project = await detectProject(root);
  const run = await runChecks(project, ["unit"], root);
  process.stdout.write(`${renderRun(run)}\n`);
  return verdictExitCode(run.verdict);
}
