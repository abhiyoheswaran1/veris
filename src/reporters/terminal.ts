import pc from "picocolors";
import { isPlain } from "../cli/tty.js";
import type { CheckResult, VerificationRun } from "../core/model.js";

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

export function renderRun(run: VerificationRun): string {
  const plain = isPlain();
  const bold = (s: string) => (plain ? s : pc.bold(s));
  const dim = (s: string) => (plain ? s : pc.dim(s));
  const lines: string[] = [];
  lines.push(bold("Veris"));
  lines.push("");
  lines.push(
    `Project     ${run.project.root.split("/").pop() ?? run.project.root}`,
  );
  lines.push(`Risk        ${dim("—")}`);
  lines.push("");
  lines.push("Checks");
  for (const r of run.results) {
    const detail =
      r.status === "skipped"
        ? dim(`skipped — ${r.summary}`)
        : secs(r.durationMs);
    lines.push(`  ${glyph(r.status, plain)} ${r.checkId.padEnd(14)} ${detail}`);
    if (r.outputTail) {
      for (const tail of r.outputTail.split("\n")) {
        lines.push(dim(`    ${tail}`));
      }
    }
  }
  lines.push("");
  lines.push("Result");
  const verb =
    run.verdict.state === "verified"
      ? plain
        ? "✓ Verified"
        : pc.green("✓ Verified")
      : run.verdict.state === "failed"
        ? plain
          ? "✗ Failed"
          : pc.red("✗ Failed")
        : plain
          ? "▲ Partial"
          : pc.yellow("▲ Partial");
  lines.push(`  ${verb}`);
  if (run.reportRef) {
    lines.push("");
    lines.push("Report");
    lines.push(`  ${run.reportRef}`);
  }
  return lines.join("\n");
}
