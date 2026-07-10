import { readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VerificationRun } from "../core/model.js";
import { ensureDir } from "../util/fs-safe.js";
import type { EvidenceRecord } from "./record.js";
import { sha256 } from "./record.js";

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

export async function writeEvidence(
  runDir: string,
  record: EvidenceRecord,
): Promise<string> {
  const ref = join(runDir, "evidence.json");
  await writeFile(ref, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return ref;
}

export async function digestLogs(
  run: VerificationRun,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const r of run.results) {
    if (!r.logRef) continue;
    try {
      out[r.checkId] = sha256(await readFile(r.logRef, "utf8"));
    } catch {
      // log missing: leave this check without a digest
    }
  }
  return out;
}

export async function readRunLogs(
  runDir: string,
  checkIds: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of checkIds) {
    try {
      out[id] = await readFile(join(runDir, `${id}.log`), "utf8");
    } catch {
      // no log for this check
    }
  }
  return out;
}

export function latestRunDir(root: string): string | null {
  const runs = join(root, ".veris", "runs");
  try {
    const dirs = readdirSync(runs, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "watch")
      .map((d) => d.name)
      .sort();
    const latest = dirs.at(-1);
    return latest ? join(runs, latest) : null;
  } catch {
    return null;
  }
}

export async function ensureEvidenceDir(root: string): Promise<string> {
  const dir = join(root, ".veris", "evidence");
  await ensureDir(dir);
  return dir;
}
