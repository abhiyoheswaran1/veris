import {
  affectedProject,
  analyze,
  buildGraph,
  detectFlaky,
  detectProject,
  getEnvironmentInfo,
  loadRuns,
  verifyEvidenceFile,
  verifyProject,
} from "veriskit";
import { fail, json, root, type ToolResult } from "./format.js";

export async function doctorHandler(input: {
  path?: string;
}): Promise<ToolResult> {
  const project = await detectProject(root(input));
  return json({
    project: project.name ?? null,
    capabilities: project.capabilities,
    environment: getEnvironmentInfo(project.packageManager),
  });
}

export async function scanHandler(input: {
  path?: string;
}): Promise<ToolResult> {
  const project = await detectProject(root(input));
  const graph = await buildGraph(project);
  const analysis = analyze(graph);
  return json({
    resolver: graph.resolver,
    sourceFiles: graph.sourceFiles.length,
    testFiles: graph.testFiles.length,
    untested: analysis.untested.slice(0, 20),
  });
}

export async function planHandler(input: {
  path?: string;
  base?: string;
}): Promise<ToolResult> {
  const project = await detectProject(root(input));
  const graph = await buildGraph(project);
  const analysis = analyze(graph);
  return json({
    resolver: graph.resolver,
    recommendUntested: analysis.untested.slice(0, 20),
    risky: analysis.risky,
  });
}

export async function logHandler(input: {
  path?: string;
  limit?: number;
  flaky?: boolean;
}): Promise<ToolResult> {
  const records = loadRuns(root(input), input.limit ?? 20);
  if (input.flaky) {
    return json({ flaky: detectFlaky(records) });
  }
  return json({
    runs: records.map((r) => ({
      startedAt: r.startedAt,
      verdict: r.verdict.state,
      checks: r.checks.map((c) => ({ id: c.id, status: c.status })),
      commit: r.git?.commit?.slice(0, 7) ?? null,
    })),
  });
}

export async function evidenceVerifyHandler(input: {
  file: string;
}): Promise<ToolResult> {
  if (!input.file) return fail("evidence_verify requires a `file` path.");
  try {
    const result = await verifyEvidenceFile(input.file);
    return json({
      ok: result.ok,
      kind: result.kind,
      signed: result.signed,
      verdict: result.record.verdict.state,
      checks: result.checks,
    });
  } catch (err) {
    return fail(
      `cannot read evidence at ${input.file}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function verifyHandler(input: {
  path?: string;
  partialOk?: boolean;
  browser?: boolean;
}): Promise<ToolResult> {
  const { run, record } = await verifyProject(root(input), {
    partialOk: input.partialOk,
    browser: input.browser,
  });
  return json({
    verdict: run.verdict.state,
    skipped: run.verdict.skipped,
    reasons: run.verdict.reasons,
    checks: run.results.map((r) => ({
      id: r.checkId,
      status: r.status,
      durationMs: r.durationMs,
      summary: r.summary,
    })),
    digest: record.digest,
    git: record.git,
  });
}

export async function affectedHandler(input: {
  path?: string;
  base?: string;
}): Promise<ToolResult> {
  const outcome = await affectedProject(root(input), { base: input.base });
  if (outcome.nothingAffected || !outcome.run || !outcome.record) {
    return json({
      nothingAffected: true,
      note: outcome.note,
      changedCount: outcome.changedCount,
    });
  }
  return json({
    verdict: outcome.run.verdict.state,
    note: outcome.note,
    changedCount: outcome.changedCount,
    checks: outcome.run.results.map((r) => ({
      id: r.checkId,
      status: r.status,
      summary: r.summary,
    })),
    digest: outcome.record.digest,
  });
}
