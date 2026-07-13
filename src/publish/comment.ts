import type { VerificationRun } from "../core/model.js";
import type { EvidenceRecord } from "../evidence/record.js";
import { renderMarkdown } from "../reporters/markdown.js";

export const MARKER = "<!-- veriskit-report -->";

const STATE_LABEL = {
  verified: "verified",
  failed: "failed",
  partial: "partial",
} as const;

export function renderComment(
  run: VerificationRun,
  record?: EvidenceRecord,
): string {
  const summary = run.results
    .filter((r) => r.status !== "skipped")
    .map((r) => `${r.checkId} ${r.status}`)
    .join(" · ");
  return [
    MARKER,
    `**VerisKit: ${STATE_LABEL[run.verdict.state]}**`,
    "",
    summary,
    "",
    "<details><summary>Report</summary>",
    "",
    renderMarkdown(run, record),
    "",
    "</details>",
    "",
  ].join("\n");
}
