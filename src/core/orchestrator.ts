import { createRunDir, newRunId } from "../evidence/store.js";
import { runners } from "../runners/index.js";
import { getEnvironmentInfo } from "../util/env.js";
import {
  type CapabilityId,
  type CheckResult,
  checkKey,
  type Project,
  type VerificationRun,
} from "./model.js";
import { computeVerdict } from "./verdict.js";

export async function runChecks(
  project: Project,
  ids: CapabilityId[],
  root: string,
  opts: { targetFiles?: Partial<Record<CapabilityId, string[]>> } = {},
): Promise<VerificationRun> {
  const known = new Set(project.capabilities.map((c) => c.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown check id(s): ${unknown.join(", ")}`);
  }

  const id = newRunId();
  const runDir = await createRunDir(root, id);
  const ctx = { root, runDir };

  const requested = project.capabilities.filter((c) => ids.includes(c.id));

  const tasks = requested.map(async (cap): Promise<CheckResult> => {
    const key = checkKey(cap.id, cap.language);
    const runner = cap.runner ? runners[cap.runner] : undefined;
    if (!cap.available || !runner) {
      const summary = !cap.available
        ? (cap.reason ?? "not configured")
        : `no runner registered for ${cap.runner}`;
      return { checkId: key, status: "skipped", durationMs: 0, summary };
    }
    const check = runner.toCheck(project, cap, {
      targetFiles: opts.targetFiles?.[cap.id],
    });
    return runner.run(check, ctx);
  });

  const results = await Promise.all(tasks);
  const verdict = computeVerdict(results, requested);

  return {
    id,
    startedAt: new Date().toISOString(),
    project,
    results,
    verdict,
    env: getEnvironmentInfo(project.packageManager),
  };
}
