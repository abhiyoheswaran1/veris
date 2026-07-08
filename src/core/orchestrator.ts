import { createRunDir, newRunId } from "../evidence/store.js";
import { runners } from "../runners/index.js";
import { getEnvironmentInfo } from "../util/env.js";
import type {
  CapabilityId,
  CheckResult,
  Project,
  VerificationRun,
} from "./model.js";
import { computeVerdict } from "./verdict.js";

export async function runChecks(
  project: Project,
  ids: CapabilityId[],
  root: string,
): Promise<VerificationRun> {
  const id = newRunId();
  const runDir = await createRunDir(root, id);
  const ctx = { root, runDir };

  const tasks = ids.map(async (capId): Promise<CheckResult> => {
    const cap = project.capabilities.find((c) => c.id === capId);
    const runner = cap?.runner ? runners[cap.runner] : undefined;
    if (!cap?.available || !runner) {
      return {
        checkId: capId,
        status: "skipped",
        durationMs: 0,
        summary: cap?.reason ?? "not configured",
      };
    }
    const check = runner.toCheck(project, cap);
    return runner.run(check, ctx);
  });

  const results = await Promise.all(tasks);
  const verdict = computeVerdict(results, project.capabilities);

  return {
    id,
    startedAt: new Date().toISOString(),
    project,
    results,
    verdict,
    env: getEnvironmentInfo(project.packageManager),
  };
}
