import type { EvidenceRecord } from "./record.js";
import { canonicalize, sha256 } from "./record.js";
import type { EvidenceCheckResult, VerifyResult } from "./verify-evidence.js";
import { verifyRecord } from "./verify-evidence.js";

export const BUNDLE_SCHEMA = "veriskit/bundle@1";

export interface Bundle {
  schema: string;
  record: EvidenceRecord;
  report: string;
  logs: Record<string, string>;
  manifest: { record: string; report: string; logs: Record<string, string> };
  bundleDigest: string;
}

export function buildBundle(
  record: EvidenceRecord,
  report: string,
  logs: Record<string, string>,
): Bundle {
  const manifest = {
    record: record.digest,
    report: sha256(report),
    logs: Object.fromEntries(
      Object.entries(logs).map(([k, v]) => [k, sha256(v)]),
    ),
  };
  const base = { schema: BUNDLE_SCHEMA, record, report, logs, manifest };
  return { ...base, bundleDigest: sha256(canonicalize(base)) };
}

export function verifyBundle(bundle: Bundle): VerifyResult {
  const checks: EvidenceCheckResult[] = [];

  const recordResult = verifyRecord(bundle.record);
  checks.push(...recordResult.checks);

  const reportDigest = sha256(bundle.report);
  checks.push({
    name: "report",
    ok: reportDigest === bundle.manifest.report,
    detail:
      reportDigest === bundle.manifest.report ? "matches manifest" : "mismatch",
  });

  for (const [id, body] of Object.entries(bundle.logs)) {
    const d = sha256(body);
    checks.push({
      name: `log:${id}`,
      ok: d === bundle.manifest.logs[id],
      detail: d === bundle.manifest.logs[id] ? "matches manifest" : "mismatch",
    });
  }

  const { bundleDigest: _omit, ...rest } = bundle;
  const recomputed = sha256(canonicalize(rest));
  checks.push({
    name: "bundle digest",
    ok: recomputed === bundle.bundleDigest,
    detail: recomputed === bundle.bundleDigest ? "matches" : "mismatch",
  });

  return {
    ok: checks.every((c) => c.ok),
    kind: "bundle",
    record: bundle.record,
    checks,
    signed: false,
  };
}
