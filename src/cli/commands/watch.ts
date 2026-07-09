import { affectedChecks } from "../../affected/gate.js";
import { detectProject } from "../../config/detect.js";
import type { CapabilityId, CheckResult, Project } from "../../core/model.js";
import { runChecks } from "../../core/orchestrator.js";
import { changedFiles } from "../../git/changes.js";
import { renderRun } from "../../reporters/terminal.js";
import { watch } from "../../watch/watcher.js";

export function buildWatchResults(
  project: Project,
  affected: CapabilityId[],
  fresh: CheckResult[],
  cache: Map<string, CheckResult>,
): CheckResult[] {
  const affectedSet = new Set(affected);
  const freshById = new Map(fresh.map((r) => [r.checkId, r]));
  const out: CheckResult[] = [];
  for (const cap of project.capabilities) {
    if (!cap.available || cap.id === "browser") continue;
    const f = freshById.get(cap.id);
    if (f) {
      out.push({ ...f, cached: false });
      continue;
    }
    const c = cache.get(cap.id);
    if (c && !affectedSet.has(cap.id)) {
      out.push({ ...c, cached: true });
      continue;
    }
    out.push({
      checkId: cap.id,
      status: "skipped",
      durationMs: 0,
      summary: "not affected by changes",
    });
  }
  return out;
}

export async function runWatch(
  root: string,
  opts: { poll?: boolean } = {},
): Promise<number> {
  const cache = new Map<string, CheckResult>();
  let running = false;

  const availableIds = (project: Project): CapabilityId[] =>
    project.capabilities
      .filter((c) => c.available && c.id !== "browser")
      .map((c) => c.id);

  // `initial` runs a full baseline over all available checks; later ticks run
  // only the checks affected by the current uncommitted changes.
  const tick = async (initial: boolean): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const project = await detectProject(root);
      const { files } = await changedFiles(root);
      const checks = initial
        ? availableIds(project)
        : affectedChecks(files, project).checks;
      let fresh: CheckResult[] = [];
      let verdictRun = null as Awaited<ReturnType<typeof runChecks>> | null;
      if (checks.length) {
        verdictRun = await runChecks(project, checks, root);
        fresh = verdictRun.results;
        for (const r of fresh) cache.set(r.checkId, { ...r });
      }
      const results = buildWatchResults(project, checks, fresh, cache);
      const run = {
        id: "watch",
        startedAt: new Date().toISOString(),
        project,
        results,
        verdict: verdictRun?.verdict ?? {
          state: "verified" as const,
          verifiedCapabilities: [],
          skipped: [],
          reasons: [],
        },
        env: {
          os: process.platform,
          node: process.version,
          pm: project.packageManager,
          ci: false,
          timestamp: new Date().toISOString(),
        },
        scope: { kind: "watch" as const, changedCount: files.length },
      };
      process.stdout.write(`${renderRun(run)}\n`);
    } finally {
      running = false;
    }
  };

  process.stdout.write("veris watch — press Ctrl-C to stop\n");
  await tick(true);

  return await new Promise<number>((resolve) => {
    let stop: () => void;
    try {
      stop = watch(root, { poll: opts.poll }, () => {
        void tick(false);
      });
    } catch (err) {
      process.stderr.write(
        `veris: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      resolve(1);
      return;
    }
    process.on("SIGINT", () => {
      stop();
      process.stdout.write("\nStopped.\n");
      resolve(0);
    });
  });
}
