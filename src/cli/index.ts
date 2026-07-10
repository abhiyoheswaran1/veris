import { realpathSync } from "node:fs";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import cac from "cac";
import { VERSION } from "../version.js";

export function buildCli() {
  const cli = cac("veris");
  cli.version(VERSION);
  cli.help();

  cli
    .command("doctor", "Report environment + capabilities (read-only)")
    .action(async () => {
      const { runDoctor } = await import("./commands/doctor.js");
      process.exitCode = await runDoctor(process.cwd());
    });

  cli.command("test", "Run the detected unit test runner").action(async () => {
    const { runTest } = await import("./commands/test.js");
    process.exitCode = await runTest(process.cwd());
  });

  cli
    .command("init", "Detect the stack and set up .veris (idempotent)")
    .action(async () => {
      const { runInit } = await import("./commands/init.js");
      process.exitCode = await runInit(process.cwd());
    });

  cli
    .command("verify", "Run the full check set and produce a verdict + report")
    .option("--partial-ok", "Exit 0 even when the verdict is partial")
    .action(async (opts: { partialOk?: boolean }) => {
      const { runVerify } = await import("./commands/verify.js");
      process.exitCode = await runVerify(process.cwd(), {
        partialOk: opts.partialOk,
      });
    });

  cli
    .command("report", "Print the latest verification report")
    .action(async () => {
      const { runReport } = await import("./commands/report.js");
      process.exitCode = await runReport(process.cwd());
    });

  cli
    .command("affected", "Run only the checks affected by changed files")
    .option("--base <ref>", "Compare against a git ref instead of HEAD")
    .option("--partial-ok", "Exit 0 even when the verdict is partial")
    .action(async (opts: { base?: string; partialOk?: boolean }) => {
      const { runAffected } = await import("./commands/affected.js");
      process.exitCode = await runAffected(process.cwd(), {
        base: opts.base,
        partialOk: opts.partialOk,
      });
    });

  cli
    .command("watch", "Re-run affected checks as files change (Ctrl-C to stop)")
    .option("--poll", "Use mtime polling instead of native fs.watch")
    .action(async (opts: { poll?: boolean }) => {
      const { runWatch } = await import("./commands/watch.js");
      process.exitCode = await runWatch(process.cwd(), { poll: opts.poll });
    });

  cli
    .command("scan", "Map the import graph and untested areas (read-only)")
    .action(async () => {
      const { runScan } = await import("./commands/scan.js");
      process.exitCode = await runScan(process.cwd());
    });

  cli
    .command(
      "plan",
      "Recommend what to test, from the import graph (read-only)",
    )
    .option("--base <ref>", "Also factor in changes vs a git ref")
    .action(async (opts: { base?: string }) => {
      const { runPlan } = await import("./commands/plan.js");
      process.exitCode = await runPlan(process.cwd(), { base: opts.base });
    });

  return { raw: cli, version: VERSION };
}

export async function main(argv: string[]): Promise<void> {
  try {
    const { raw } = buildCli();
    if (argv.length <= 2) {
      raw.outputHelp();
      return;
    }
    raw.parse(argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`veris: ${msg}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = argv[1] ? realpathSync(argv[1]) : "";
const isEntry = import.meta.url === pathToFileURL(invokedPath).href;
if (isEntry) void main(argv);
