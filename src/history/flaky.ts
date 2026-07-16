import type { CheckStatus } from "../core/model.js";
import type { EvidenceRecord } from "../evidence/record.js";

export interface FlakyCheck {
  id: string; // composite key, e.g. "unit:js"
  statuses: CheckStatus[];
}

export function detectFlaky(records: EvidenceRecord[]): FlakyCheck[] {
  const byId = new Map<string, CheckStatus[]>();
  for (const rec of records) {
    for (const c of rec.checks ?? []) {
      const arr = byId.get(c.id) ?? [];
      arr.push(c.status);
      byId.set(c.id, arr);
    }
  }
  const flaky: FlakyCheck[] = [];
  for (const [id, statuses] of byId) {
    if (statuses.includes("passed") && statuses.includes("failed")) {
      flaky.push({ id, statuses });
    }
  }
  return flaky;
}
