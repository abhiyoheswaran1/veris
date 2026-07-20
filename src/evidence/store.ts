import { readdirSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VerificationRun } from "../core/model.js";
import { ensureDir, readJsonIfExists } from "../util/fs-safe.js";
import type { Attestation } from "./attestation.js";
import type { AttestationV2 } from "./dsse.js";
import type { EvidenceRecord } from "./record.js";
import { sha256 } from "./record.js";

let counter = 0;

function logFileName(checkId: string): string {
  return `${checkId.replace(/:/g, "-")}.log`;
}

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
  const ref = join(runDir, logFileName(checkId));
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
      out[id] = await readFile(join(runDir, logFileName(id)), "utf8");
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

export function attestationsDir(root: string): string {
  return join(root, ".veris", "attestations");
}

export async function writeAttestation(
  root: string,
  id: string,
  att: Attestation | AttestationV2,
): Promise<string> {
  const dir = attestationsDir(root);
  await ensureDir(dir);
  const ref = join(dir, `${id}.att.json`);
  await writeFile(ref, `${JSON.stringify(att, null, 2)}\n`, "utf8");
  return ref;
}

export function latestAttestation(
  root: string,
): { path: string; att: Attestation } | null {
  try {
    const files = readdirSync(attestationsDir(root))
      .filter((f) => f.endsWith(".att.json"))
      .sort();
    const latest = files.at(-1);
    if (!latest) return null;
    const path = join(attestationsDir(root), latest);
    return { path, att: JSON.parse(readFileSync(path, "utf8")) as Attestation };
  } catch {
    return null;
  }
}

export async function readLatestRecord(
  root: string,
): Promise<EvidenceRecord | null> {
  const dir = latestRunDir(root);
  if (!dir) return null;
  return readJsonIfExists<EvidenceRecord>(join(dir, "evidence.json"));
}
