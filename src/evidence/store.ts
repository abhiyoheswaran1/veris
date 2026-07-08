import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VerificationRun } from "../core/model.js";
import { ensureDir } from "../util/fs-safe.js";

let counter = 0;

export function newRunId(): string {
  counter += 1;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${counter}`;
}

export async function createRunDir(root: string, id: string): Promise<string> {
  const dir = join(root, ".veris", "runs", id);
  await ensureDir(dir);
  return dir;
}

export async function writeLog(
  runDir: string,
  checkId: string,
  content: string,
): Promise<string> {
  const ref = join(runDir, `${checkId}.log`);
  await writeFile(ref, content, "utf8");
  return ref;
}

export async function writeMetadata(
  runDir: string,
  run: VerificationRun,
): Promise<string> {
  const ref = join(runDir, "metadata.json");
  await writeFile(ref, JSON.stringify(run, null, 2), "utf8");
  return ref;
}

export async function writeReport(
  root: string,
  id: string,
  markdown: string,
): Promise<string> {
  const dir = join(root, ".veris", "reports");
  await ensureDir(dir);
  const ref = join(dir, `verify-${id}.md`);
  await writeFile(ref, markdown, "utf8");
  return ref;
}
