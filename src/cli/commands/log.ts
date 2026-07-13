import { detectFlaky } from "../../history/flaky.js";
import { loadRuns } from "../../history/read.js";

export async function runLog(
  root: string,
  opts: { limit?: number; flaky?: boolean } = {},
): Promise<number> {
  const limit =
    Number.isFinite(opts.limit) && (opts.limit as number) > 0
      ? (opts.limit as number)
      : 20;
  const records = loadRuns(root, limit);
  if (records.length === 0) {
    process.stdout.write("No runs yet. Run `veris verify` first.\n");
    return 0;
  }

  if (opts.flaky) {
    const flaky = detectFlaky(records);
    if (flaky.length === 0) {
      process.stdout.write(
        `No flaky checks in the last ${records.length} run(s).\n`,
      );
      return 0;
    }
    process.stdout.write(
      `Flaky checks (both passed and failed in the last ${records.length} run(s), newest first):\n`,
    );
    for (const f of flaky) {
      process.stdout.write(`  ${f.id.padEnd(8)} ${f.statuses.join(" ")}\n`);
    }
    return 0;
  }

  for (const rec of records) {
    const date = rec.startedAt.slice(0, 19).replace("T", " ");
    const checks = (rec.checks ?? [])
      .map((c) => `${c.id}:${c.status}`)
      .join(" ");
    const commit = rec.git ? rec.git.commit.slice(0, 7) : "-";
    process.stdout.write(
      `${date}  ${rec.verdict.state.padEnd(9)} ${checks}  ${commit}\n`,
    );
  }
  process.stdout.write(
    "\nHistory is local to this machine (.veris/runs is gitignored).\n",
  );
  return 0;
}
