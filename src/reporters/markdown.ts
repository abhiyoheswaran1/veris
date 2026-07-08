import type { VerificationRun } from "../core/model.js";
export function renderMarkdown(run: VerificationRun): string {
  return `# Veris report ${run.id}\n`;
}
