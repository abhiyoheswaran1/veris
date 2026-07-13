import type { VerificationRun } from "../core/model.js";
import type { EvidenceRecord } from "../evidence/record.js";
import { renderMarkdown } from "../reporters/markdown.js";
import { renderComment } from "./comment.js";
import { resolvePublishContext } from "./context.js";
import { createCheckRun, upsertComment } from "./github.js";

const CONCLUSION = {
  verified: "success",
  failed: "failure",
  partial: "neutral",
} as const;

export async function publishToGitHub(
  run: VerificationRun,
  record?: EvidenceRecord,
): Promise<void> {
  const ctx = resolvePublishContext();
  if (!ctx) {
    process.stdout.write(
      "veris: --github set but no GitHub PR context found (need GITHUB_TOKEN + a pull_request event); skipping publish.\n",
    );
    return;
  }
  try {
    await upsertComment(ctx, renderComment(run, record));
    await createCheckRun(ctx, {
      name: "VerisKit",
      conclusion: CONCLUSION[run.verdict.state],
      title: `VerisKit: ${run.verdict.state}`,
      summary: renderMarkdown(run, record),
    });
    process.stdout.write(
      `veris: published the verdict to PR #${ctx.prNumber}\n`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`veris: GitHub publish failed: ${msg}\n`);
  }
}
