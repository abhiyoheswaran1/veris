import pc from "picocolors";
import { isPlain } from "../cli/tty.js";
import {
  type CheckResult,
  splitKey,
  type VerificationRun,
} from "../core/model.js";
import type { EvidenceRecord } from "../evidence/record.js";

function glyph(status: CheckResult["status"], plain: boolean): string {
  const map: Record<CheckResult["status"], string> = {
    passed: "✓",
    failed: "✗",
    skipped: "⊘",
    unknown: "?",
  };
  const g = map[status];
  if (plain) return g;
  if (status === "passed") return pc.green(g);
  if (status === "failed") return pc.red(g);
  return pc.dim(g);
}

function secs(ms: number): string {
  return ms === 0 ? "" : `${(ms / 1000).toFixed(1)}s`;
}

export function renderRun(
  run: VerificationRun,
  record?: EvidenceRecord,
): string {
  const plain = isPlain();
  const bold = (s: string) => (plain ? s : pc.bold(s));
  const dim = (s: string) => (plain ? s : pc.dim(s));
  const lines: string[] = [];
  const scoped = run.scope?.kind;
  if (scoped) {
    lines.push(bold(`VerisKit — ${scoped}`));
    lines.push("");
    lines.push(`Scope       ${run.scope?.changedCount ?? 0} changed file(s)`);
  } else {
    lines.push(bold("VerisKit"));
    lines.push("");
    lines.push(
      `Project     ${run.project.root.split("/").pop() ?? run.project.root}`,
    );
    lines.push(`Risk        ${dim("—")}`);
  }
  lines.push("");
  lines.push("Checks");
  for (const r of run.results) {
    const g = glyph(r.status, plain); // always reflect the real status — cached failures stay ✗
    const detail =
      r.status === "skipped"
        ? dim(`skipped — ${r.summary}`)
        : r.cached
          ? dim(`⟳ cached · ${secs(r.durationMs) || "—"}`)
          : secs(r.durationMs);
    const label = splitKey(r.checkId).id;
    lines.push(`  ${g} ${label.padEnd(14)} ${detail}`);
    if (r.outputTail) {
      for (const tail of r.outputTail.split("\n")) {
        lines.push(dim(`    ${tail}`));
      }
    }
  }
  lines.push("");
  lines.push("Result");
  const label =
    run.verdict.state === "verified"
      ? scoped
        ? "✓ Affected checks passed"
        : "✓ Verified"
      : run.verdict.state === "failed"
        ? scoped
          ? "✗ Affected checks failed"
          : "✗ Failed"
        : scoped
          ? "▲ Affected: partial"
          : "▲ Partial";
  const color =
    run.verdict.state === "verified"
      ? pc.green
      : run.verdict.state === "failed"
        ? pc.red
        : pc.yellow;
  lines.push(`  ${plain ? label : color(label)}`);
  if (record?.git) {
    const g = record.git;
    lines.push("");
    lines.push(
      `Commit      ${g.commit.slice(0, 7)} ${g.dirty ? "· tree dirty" : "· tree clean"}`,
    );
  }
  if (run.reportRef) {
    lines.push("");
    lines.push("Report");
    lines.push(`  ${run.reportRef}`);
  }
  return lines.join("\n");
}
