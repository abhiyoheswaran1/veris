import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { VerificationRun } from "../../core/model.js";
import { buildRecord } from "../../evidence/record.js";
import { createRunDir, writeEvidence } from "../../evidence/store.js";
import { runLog } from "./log.js";

async function seed(root: string, id: string, t: string) {
  const run = {
    id,
    startedAt: t,
    project: {
      root: "/x",
      name: "n",
      packageManager: "npm",
      frameworks: [],
      languages: [],
      scripts: {},
      capabilities: [],
    },
    results: [
      { checkId: "unit", status: "passed", durationMs: 1, summary: "" },
    ],
    verdict: {
      state: "verified",
      verifiedCapabilities: ["unit"],
      skipped: [],
      reasons: [],
    },
    env: { os: "x", node: "v24", pm: "npm", ci: false, timestamp: t },
  } as unknown as VerificationRun;
  const dir = await createRunDir(root, id);
  await writeEvidence(dir, buildRecord(run, null, {}, "0.5.0"));
}

describe("runLog", () => {
  it("prints a run list", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-log-"));
    await seed(root, "a", "2026-07-12T09:00:00.000Z");
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await runLog(root, {})).toBe(0);
    expect(out.mock.calls.join("")).toContain("verified");
    vi.restoreAllMocks();
  });

  it("says so when there are no runs", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-log-empty-"));
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await runLog(root, {})).toBe(0);
    expect(out.mock.calls.join("")).toContain("No runs yet");
    vi.restoreAllMocks();
  });

  it("reports no flaky checks for a single passing run", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-log-flaky-"));
    await seed(root, "a", "2026-07-12T09:00:00.000Z");
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await runLog(root, { flaky: true })).toBe(0);
    expect(out.mock.calls.join("")).toContain("No flaky checks");
    vi.restoreAllMocks();
  });
});
