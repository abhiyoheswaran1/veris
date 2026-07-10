import { readFile } from "node:fs/promises";
import type { EvidenceRecord } from "./record.js";
import { computeDigest } from "./record.js";

export interface EvidenceCheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  kind: "record" | "bundle";
  record: EvidenceRecord;
  checks: EvidenceCheckResult[];
}

export function verifyRecord(record: EvidenceRecord): VerifyResult {
  const recomputed = computeDigest(
    record as unknown as Record<string, unknown>,
  );
  const ok = recomputed === record.digest;
  const checks: EvidenceCheckResult[] = [
    {
      name: "record digest",
      ok,
      detail: ok
        ? "matches the canonical record"
        : `recomputed ${recomputed}, record claims ${record.digest}`,
    },
  ];
  return { ok, kind: "record", record, checks };
}

export async function verifyEvidenceFile(path: string): Promise<VerifyResult> {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (parsed?.schema === "veriskit/bundle@1") {
    const { verifyBundle } = await import("./bundle.js");
    return verifyBundle(parsed);
  }
  return verifyRecord(parsed as EvidenceRecord);
}
