import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { type Attestation, attestationStatement } from "./attestation.js";
import type { EvidenceRecord } from "./record.js";
import { sha256 } from "./record.js";
import {
  attestationsDir,
  createRunDir,
  digestLogs,
  latestAttestation,
  newRunId,
  writeAttestation,
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

describe("writeLog", () => {
  it("sanitizes ':' out of the log filename", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-log-"));
    const ref = await writeLog(dir, "unit:js", "hello\n");
    expect(ref.endsWith("unit-js.log")).toBe(true);
    expect(await readFile(ref, "utf8")).toBe("hello\n");
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

describe("attestation store", () => {
  const att = (commit: string): Attestation => ({
    schema: "veriskit/attestation@1",
    statement: {
      _type: "https://in-toto.io/Statement/v1",
      subject: [{ name: "demo", digest: { gitCommit: commit } }],
      predicateType: "https://veriskit.dev/attestations/verification/v1",
      // biome-ignore lint/suspicious/noExplicitAny: minimal predicate for the store round-trip
      predicate: { id: "r1" } as any,
    },
    signature: null,
  });

  it("writes and reads back the latest attestation", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-att-"));
    await writeAttestation(root, "run-1", att("a".repeat(40)));
    const found = latestAttestation(root);
    expect(
      found && attestationStatement(found.att).subject[0]?.digest.gitCommit,
    ).toBe("a".repeat(40));
    expect(found?.path.startsWith(attestationsDir(root))).toBe(true);
  });

  it("returns null when there are no attestations", () => {
    const root = mkdtempSync(join(tmpdir(), "veris-att-none-"));
    expect(latestAttestation(root)).toBeNull();
  });
});
