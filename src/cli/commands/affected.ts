import { affectedProject } from "../../core/orchestrate.js";
import { verdictExitCode } from "../../core/verdict.js";
import { publishToGitHub } from "../../publish/publish.js";
import { renderRun } from "../../reporters/terminal.js";

export async function runAffected(
  root: string,
  opts: { base?: string; partialOk?: boolean; github?: boolean } = {},
): Promise<number> {
  const outcome = await affectedProject(root, opts);
  if (outcome.nothingAffected || !outcome.run || !outcome.record) {
    process.stdout.write(`${outcome.note}\n`);
    return 0;
  }
  const { run, record, note } = outcome;
  process.stdout.write(`${renderRun(run, record)}\n`);
  if (note) process.stdout.write(`${note}\n`);
  if (opts.github) await publishToGitHub(run, record);
  return verdictExitCode(run.verdict, opts);
}
