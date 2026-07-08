import type {
  Capability,
  CapabilityId,
  CheckResult,
  Verdict,
} from "./model.js";

const CHECKED: CapabilityId[] = ["types", "lint", "unit"];

export function computeVerdict(
  results: CheckResult[],
  capabilities: Capability[],
): Verdict {
  const reasons: string[] = [];
  const skipped: CapabilityId[] = [];
  const verifiedCapabilities: CapabilityId[] = [];

  const anyFailed = results.some((r) => r.status === "failed");
  const anyUnknown = results.some((r) => r.status === "unknown");

  for (const id of CHECKED) {
    const cap = capabilities.find((c) => c.id === id);
    if (!cap) continue; // capability not applicable to this project

    const result = results.find((r) => r.checkId === id);
    if (!cap.available) {
      skipped.push(id);
      reasons.push(`${id} skipped — ${cap.reason ?? "not configured"}`);
      continue;
    }
    if (result?.status === "passed") verifiedCapabilities.push(id);
  }

  let state: Verdict["state"];
  if (anyFailed) state = "failed";
  else if (skipped.length > 0 || anyUnknown) state = "partial";
  else state = "verified";

  return { state, verifiedCapabilities, skipped, reasons };
}

export function verdictExitCode(
  verdict: Verdict,
  opts: { partialOk?: boolean } = {},
): number {
  if (verdict.state === "failed") return 1;
  if (verdict.state === "partial") return opts.partialOk ? 0 : 2;
  return 0;
}
