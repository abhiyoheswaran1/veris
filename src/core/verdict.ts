import {
  type Capability,
  type CheckResult,
  checkKey,
  type Verdict,
} from "./model.js";

export function computeVerdict(
  results: CheckResult[],
  capabilities: Capability[],
): Verdict {
  const reasons: string[] = [];
  const skipped: string[] = [];
  const verifiedCapabilities: string[] = [];

  const anyFailed = results.some((r) => r.status === "failed");

  for (const cap of capabilities) {
    const key = checkKey(cap.id, cap.language);
    const result = results.find((r) => r.checkId === key);

    if (!cap.available) {
      skipped.push(key);
      reasons.push(`${cap.id} skipped — ${cap.reason ?? "not configured"}`);
      continue;
    }
    if (result?.status === "passed") {
      verifiedCapabilities.push(key);
      continue;
    }
    if (result?.status === "failed") {
      reasons.push(`${cap.id} failed — ${result.summary}`);
      continue;
    }
    skipped.push(key);
    reasons.push(`${cap.id} skipped — ${result?.summary ?? "did not run"}`);
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
