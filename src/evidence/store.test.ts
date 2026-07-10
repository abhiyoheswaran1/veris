import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import type { EvidenceRecord } from "./record.js";
import { sha256 } from "./record.js";
import {
  createRunDir,
  digestLogs,
  newRunId,
  writeEvidence,
  writeLog,
  writeReport,
} from "./store.js";

function minimalRecord(): EvidenceRecord {
  return {
    schema: "veriskit/evidence@1",
    id: "run-1",
    startedAt: "2026-07-10T00:00:00.000Z",
    tool: { name: "veriskit", version: "0.4.0" },
    git: null,
    env: { os: "x", node: "v24", pm: "npm", ci: false, timestamp: "t" },
    project: {
      name: "demo",
      packageManager: "npm",
      frameworks: [],
      languages: [],
    },
    scope: { kind: "full", changedCount: 0 },
    checks: [],
    verdict: {
      state: "verified",
      verifiedCapabilities: [],
      skipped: [],
      reasons: [],
    },
    digest: "sha256:00",
  };
}

describe("evidence store", () => {
  it("newRunId is filesystem-safe and unique-ish", () => {
    expect(newRunId()).toMatch(/^[0-9A-Za-z_-]+$/);
    expect(newRunId()).not.toBe(newRunId());
  });

  it("createRunDir + writeLog writes under .veris/runs", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-"));
    const id = newRunId();
    const runDir = await createRunDir(root, id);
    const ref = await writeLog(runDir, "types", "tsc output");
    expect(existsSync(ref)).toBe(true);
    expect(readFileSync(ref, "utf8")).toBe("tsc output");
    expect(runDir).toContain(join(".veris", "runs", id));
  });

  it("writeReport writes markdown under .veris/reports", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-"));
    const ref = await writeReport(root, "abc", "# report");
    expect(existsSync(ref)).toBe(true);
    expect(ref).toContain(join(".veris", "reports"));
  });
});

describe("writeEvidence", () => {
  it("writes evidence.json into the run dir", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-store-"));
    const dir = await createRunDir(root, "run-1");
    const ref = await writeEvidence(dir, minimalRecord());
    expect(ref).toContain("evidence.json");
    expect(JSON.parse(readFileSync(ref, "utf8")).schema).toBe(
      "veriskit/evidence@1",
    );
  });
});

describe("digestLogs", () => {
  it("hashes each check log by its logRef", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-logs-"));
    const dir = await createRunDir(root, "run-2");
    const logPath = join(dir, "unit.log");
    writeFileSync(logPath, "log body\n");
    const run = {
      results: [
        {
          checkId: "unit",
          status: "passed",
          durationMs: 1,
          summary: "",
          logRef: logPath,
        },
      ],
    } as unknown as VerificationRun;
    const digests = await digestLogs(run);
    expect(digests.unit).toBe(sha256("log body\n"));
  });
});
