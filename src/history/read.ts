import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EvidenceRecord } from "../evidence/record.js";

export function loadRuns(root: string, limit = 20): EvidenceRecord[] {
  const runs = join(root, ".veris", "runs");
  let names: string[];
  try {
    names = readdirSync(runs, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "watch")
      .map((d) => d.name);
  } catch {
    return [];
  }
  const records: EvidenceRecord[] = [];
  for (const name of names) {
    try {
      const rec = JSON.parse(
        readFileSync(join(runs, name, "evidence.json"), "utf8"),
      ) as EvidenceRecord;
      if (rec?.schema === "veriskit/evidence@1") records.push(rec);
    } catch {
      // skip unreadable/invalid records
    }
  }
  records.sort((a, b) =>
    a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0,
  );
  return records.slice(0, limit);
}
