import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { EvidenceRecord } from "../../evidence/record.js";
import { latestRunDir } from "../../evidence/store.js";
import { buildBadge } from "../../publish/badge.js";

export async function runBadge(
  root: string,
  opts: { out?: string } = {},
): Promise<number> {
  const dir = latestRunDir(root);
  if (!dir) {
    process.stdout.write("No runs yet. Run `veris verify` first.\n");
    return 1;
  }
  let record: EvidenceRecord;
  try {
    record = JSON.parse(
      readFileSync(join(dir, "evidence.json"), "utf8"),
    ) as EvidenceRecord;
  } catch {
    process.stderr.write(`veris: no evidence.json in ${dir}\n`);
    return 1;
  }
  const out = opts.out ?? join(root, ".veris", "badge.json");
  await mkdir(dirname(out), { recursive: true });
  await writeFile(
    out,
    `${JSON.stringify(buildBadge(record.verdict), null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`Wrote badge ${out}\n`);
  return 0;
}
