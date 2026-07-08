import cac from "cac";
import { VERSION } from "../version.js";

export function buildCli() {
  const cli = cac("veris");
  cli.version(VERSION);
  cli.help();
  return { raw: cli, version: VERSION };
}

export function run(argv: string[]): void {
  const { raw } = buildCli();
  raw.parse(argv);
}

run(process.argv);
