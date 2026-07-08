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
    .command("verify", "Run the full check set and produce a verdict + report")
    .option("--partial-ok", "Exit 0 even when the verdict is partial")
    .action(async (opts: { partialOk?: boolean }) => {
      const { runVerify } = await import("./commands/verify.js");
      process.exitCode = await runVerify(process.cwd(), {
        partialOk: opts.partialOk,
      });
    });

  return { raw: cli, version: VERSION };
}

export function run(argv: string[]): void {
  const { raw } = buildCli();
  raw.parse(argv);
}

run(process.argv);
