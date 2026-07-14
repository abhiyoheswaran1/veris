import { verifyProject } from "../../core/orchestrate.js";
import { verdictExitCode } from "../../core/verdict.js";
import { publishToGitHub } from "../../publish/publish.js";
import { renderRun } from "../../reporters/terminal.js";

export async function runVerify(
  root: string,
  opts: { partialOk?: boolean; github?: boolean; browser?: boolean } = {},
): Promise<number> {
  const { run, record } = await verifyProject(root, opts);
  process.stdout.write(`${renderRun(run, record)}\n`);
  if (opts.github) await publishToGitHub(run, record);
  return verdictExitCode(run.verdict, opts);
}
