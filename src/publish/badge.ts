import type { Verdict } from "../core/model.js";

export interface Badge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

const STYLE: Record<Verdict["state"], { message: string; color: string }> = {
  verified: { message: "verified", color: "14b8a6" },
  failed: { message: "failed", color: "e5484d" },
  partial: { message: "partial", color: "f5a623" },
};

export function buildBadge(verdict: Verdict): Badge {
  const s = STYLE[verdict.state];
  return {
    schemaVersion: 1,
    label: "veriskit",
    message: s.message,
    color: s.color,
  };
}
