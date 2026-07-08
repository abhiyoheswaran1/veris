import type {
  Capability,
  CapabilityId,
  CheckResult,
  Verdict,
} from "./model.js";

// browser is intentionally excluded from the verdict set — it is detect-only
// in v0.1 (execution deferred to v0.5).
const CHECKED: CapabilityId[] = ["types", "lint", "unit"];

export function computeVerdict(
  results: CheckResult[],
  capabilities: Capability[],
): Verdict {
  const reasons: string[] = [];
  const skipped: CapabilityId[] = [];
  const verifiedCapabilities: CapabilityId[] = [];

  const anyFailed = results.some((r) => r.status === "failed");

  for (const id of CHECKED) {
    const cap = capabilities.find((c) => c.id === id);
    if (!cap) continue; // capability not applicable to this project

    const result = results.find((r) => r.checkId === id);

    if (!cap.available) {
      skipped.push(id);
      reasons.push(`${id} skipped — ${cap.reason ?? "not configured"}`);
      continue;
    }

    if (result?.status === "passed") {
      verifiedCapabilities.push(id);
      continue;
    }
    if (result?.status === "failed") {
      continue; // the failure is captured by anyFailed below
    }

    // Available, but the check did not pass or fail: it was skipped, unknown,
    // or never run. An available capability that did not actually pass must
    // NOT be counted as verified — fold it into skipped so the verdict is partial.
    skipped.push(id);
    reasons.push(`${id} skipped — ${result?.summary ?? "did not run"}`);
  }

  let state: Verdict["state"];
  if (anyFailed) state = "failed";
  else if (skipped.length > 0) state = "partial";
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
