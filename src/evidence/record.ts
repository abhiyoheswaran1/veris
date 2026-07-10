import { createHash } from "node:crypto";
import { basename } from "node:path";
import type {
  CapabilityId,
  CheckStatus,
  VerdictState,
  VerificationRun,
} from "../core/model.js";
import type { GitAnchor } from "../git/changes.js";

export const EVIDENCE_SCHEMA = "veriskit/evidence@1";

export interface EvidenceCheck {
  id: CapabilityId;
  status: CheckStatus;
  runner?: string;
  durationMs: number;
  summary: string;
  counts?: { passed?: number; failed?: number; total?: number };
  logDigest?: string;
}

export interface EvidenceRecord {
  schema: string;
  id: string;
  startedAt: string;
  tool: { name: string; version: string };
  git: GitAnchor | null;
  env: { os: string; node: string; pm: string; ci: boolean; timestamp: string };
  project: {
    name: string;
    packageManager: string;
    frameworks: string[];
    languages: string[];
  };
  scope: { kind: "full" | "affected" | "watch"; changedCount: number };
  checks: EvidenceCheck[];
  verdict: {
    state: VerdictState;
    verifiedCapabilities: CapabilityId[];
    skipped: CapabilityId[];
    reasons: string[];
  };
  digest: string;
}

// Deterministic serialization: sort object keys recursively, keep array order,
// drop undefined fields, no insignificant whitespace. This is the byte input
// to the digest, so it must be reproducible.
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      if (src[key] !== undefined) out[key] = sortValue(src[key]);
    }
    return out;
  }
  return value;
}

export function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

// Digest over the canonical record with the `digest` field excluded.
export function computeDigest(
  record: Record<string, unknown> & { digest?: string },
): string {
  const { digest: _omit, ...rest } = record;
  return sha256(canonicalize(rest));
}

export function buildRecord(
  run: VerificationRun,
  git: GitAnchor | null,
  logDigests: Record<string, string>,
  toolVersion: string,
): EvidenceRecord {
  const runnerOf = new Map(
    run.project.capabilities.map((c) => [c.id, c.runner] as const),
  );

  const checks: EvidenceCheck[] = run.results.map((r) => {
    const check: EvidenceCheck = {
      id: r.checkId,
      status: r.status,
      durationMs: r.durationMs,
      summary: r.summary,
    };
    const runner = runnerOf.get(r.checkId);
    if (runner) check.runner = runner;
    if (r.counts) check.counts = r.counts;
    const digest = logDigests[r.checkId];
    if (digest) check.logDigest = digest;
    return check;
  });

  const scope: EvidenceRecord["scope"] = run.scope
    ? { kind: run.scope.kind, changedCount: run.scope.changedCount }
    : { kind: "full", changedCount: 0 };

  const base = {
    schema: EVIDENCE_SCHEMA,
    id: run.id,
    startedAt: run.startedAt,
    tool: { name: "veriskit", version: toolVersion },
    git,
    env: run.env,
    project: {
      name: run.project.name ?? basename(run.project.root),
      packageManager: run.project.packageManager,
      frameworks: run.project.frameworks,
      languages: run.project.languages,
    },
    scope,
    checks,
    verdict: run.verdict,
  };

  return { ...base, digest: computeDigest(base) };
}
