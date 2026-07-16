export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type CapabilityId = "types" | "lint" | "unit" | "browser";
export type CheckStatus = "passed" | "failed" | "skipped" | "unknown";
export type VerdictState = "verified" | "failed" | "partial";
export type Language = "js" | "python" | "go"; // "js" covers TypeScript

export interface Capability {
  id: CapabilityId;
  language: Language;
  available: boolean;
  runner?: string; // e.g. "tsc", "vitest", "eslint", "biome", "playwright"
  reason?: string; // why unavailable/skipped
}

export interface Project {
  root: string;
  name?: string;
  packageManager: PackageManager;
  frameworks: string[];
  languages: string[];
  scripts: Record<string, string>;
  capabilities: Capability[];
}

export interface Check {
  id: CapabilityId;
  language: Language;
  key: string;
  title: string;
  runner: string;
  cmd: string;
  args: string[];
}

export interface CheckResult {
  checkId: CapabilityId;
  status: CheckStatus;
  durationMs: number;
  summary: string;
  logRef?: string;
  outputTail?: string;
  counts?: { passed?: number; failed?: number; total?: number };
  cached?: boolean;
}

export interface Verdict {
  state: VerdictState;
  verifiedCapabilities: CapabilityId[];
  skipped: CapabilityId[];
  reasons: string[];
}

export interface EnvironmentInfo {
  os: string;
  node: string;
  pm: string;
  ci: boolean;
  timestamp: string;
}

export interface VerificationRun {
  id: string;
  startedAt: string;
  project: Project;
  results: CheckResult[];
  verdict: Verdict;
  reportRef?: string;
  env: EnvironmentInfo;
  scope?: { kind: "affected" | "watch"; changedCount: number };
}

export function checkKey(id: CapabilityId, language: Language): string {
  return `${id}:${language}`;
}

export function splitKey(key: string): { id: string; language: string } {
  const i = key.indexOf(":");
  if (i === -1) return { id: key, language: "js" };
  return { id: key.slice(0, i), language: key.slice(i + 1) };
}
