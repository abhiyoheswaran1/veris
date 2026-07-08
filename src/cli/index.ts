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

  return { raw: cli, version: VERSION };
}

export function run(argv: string[]): void {
  const { raw } = buildCli();
  raw.parse(argv);
}

run(process.argv);
