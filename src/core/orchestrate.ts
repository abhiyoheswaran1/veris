import { affectedChecks } from "../affected/gate.js";
import { detectProject } from "../config/detect.js";
import { loadConfig } from "../config/load.js";
import type { EvidenceRecord } from "../evidence/record.js";
import { buildRecord } from "../evidence/record.js";
import {
  createRunDir,
  digestLogs,
  writeEvidence,
  writeReport,
} from "../evidence/store.js";
import { changedFiles, gitAnchor } from "../git/changes.js";
import { renderMarkdown } from "../reporters/markdown.js";
import { VERSION } from "../version.js";
import {
  type CapabilityId,
  checkKey,
  type Project,
  type VerificationRun,
} from "./model.js";
import { runChecks } from "./orchestrator.js";

export const DEFAULT_CHECKS: CapabilityId[] = ["types", "lint", "unit"];

export function resolveChecks(
  configChecks: CapabilityId[] | undefined,
  project: Project,
  opts: { browser?: boolean },
): CapabilityId[] {
  let checks = configChecks?.length ? configChecks : DEFAULT_CHECKS;
  if (opts.browser && !checks.includes("browser")) {
    const cap = project.capabilities.find((c) => c.id === "browser");
    if (cap?.available) checks = [...checks, "browser"];
  }
  return checks;
}

export async function verifyProject(
  root: string,
  opts: { partialOk?: boolean; browser?: boolean } = {},
): Promise<{ run: VerificationRun; record: EvidenceRecord }> {
  const config = await loadConfig(root);
  const project = await detectProject(root, config);
  const checks = resolveChecks(config?.checks, project, opts);
  const run = await runChecks(project, checks, root);
  const git = await gitAnchor(root);
  const logDigests = await digestLogs(run);
  const record = buildRecord(run, git, logDigests, VERSION);
  const reportRef = await writeReport(
    root,
    run.id,
    renderMarkdown(run, record),
  );
  run.reportRef = reportRef;
  const runDir = await createRunDir(root, run.id);
  await writeEvidence(runDir, record);
  return { run, record };
}

export interface AffectedOutcome {
  run?: VerificationRun;
  record?: EvidenceRecord;
  note: string;
  changedCount: number;
  nothingAffected: boolean;
}

export async function affectedProject(
  root: string,
  opts: { base?: string } = {},
): Promise<AffectedOutcome> {
  const project = await detectProject(root);
  const { files } = await changedFiles(root, { base: opts.base });
  const plan = affectedChecks(files, project);
  if (plan.checks.length === 0) {
    return {
      note: `Nothing affected — ${files.length} changed file(s), no checks to run.`,
      changedCount: files.length,
      nothingAffected: true,
    };
  }

  let targetFiles: Partial<Record<CapabilityId, string[]>> | undefined;
  let note = "";
  const unitRunner = project.capabilities.find((c) => c.id === "unit")?.runner;
  const canNarrow = unitRunner === "vitest" || unitRunner === "jest";
  if (plan.checks.includes("unit") && canNarrow) {
    const { buildGraph } = await import("../project-graph/graph.js");
    const { selectAffectedTests } = await import("../affected/select.js");
    const graph = await buildGraph(project);
    const sel = selectAffectedTests(graph, files);
    if (sel.mode === "graph") {
      targetFiles = { unit: sel.testFiles };
      note = `unit narrowed to ${sel.testFiles.length} of ${graph.testFiles.length} test file(s) via ${graph.resolver} graph`;
    } else {
      note = `unit ran in full — ${sel.reason}`;
    }
  } else if (plan.checks.includes("unit") && unitRunner) {
    note = `unit ran in full — the ${unitRunner} runner does not support file filtering`;
  }

  const run = await runChecks(project, plan.checks, root, { targetFiles });
  run.scope = { kind: "affected", changedCount: files.length };
  const affected = new Set(plan.checks);
  for (const cap of project.capabilities) {
    if (cap.available && cap.id !== "browser" && !affected.has(cap.id)) {
      run.results.push({
        checkId: checkKey(cap.id, cap.language),
        status: "skipped",
        durationMs: 0,
        summary: "not affected by changes",
      });
    }
  }

  const git = await gitAnchor(root);
  const logDigests = await digestLogs(run);
  const record = buildRecord(run, git, logDigests, VERSION);
  const reportRef = await writeReport(
    root,
    run.id,
    renderMarkdown(run, record),
  );
  run.reportRef = reportRef;
  const runDir = await createRunDir(root, run.id);
  await writeEvidence(runDir, record);
  return {
    run,
    record,
    note,
    changedCount: files.length,
    nothingAffected: false,
  };
}
