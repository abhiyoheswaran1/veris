import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { VerificationRun } from "../../core/model.js";
import { buildRecord } from "../../evidence/record.js";
import { createRunDir, writeEvidence } from "../../evidence/store.js";
import { runEvidenceVerify } from "./evidence.js";

function record() {
  const run = {
    id: "r1",
    startedAt: "t",
    project: {
      root: "/x",
      name: "n",
      packageManager: "npm",
      frameworks: [],
      languages: [],
      scripts: {},
      capabilities: [],
    },
    results: [],
    verdict: {
      state: "verified",
      verifiedCapabilities: [],
      skipped: [],
      reasons: [],
    },
    env: { os: "x", node: "v24", pm: "npm", ci: false, timestamp: "t" },
  } as unknown as VerificationRun;
  return buildRecord(run, null, {}, "0.4.0");
}

describe("runEvidenceVerify", () => {
  it("returns 0 for an untouched evidence.json", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-ev-"));
    const dir = await createRunDir(root, "r1");
    const ref = await writeEvidence(dir, record());
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await runEvidenceVerify(ref)).toBe(0);
    vi.restoreAllMocks();
  });

  it("returns 1 for a missing file", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(await runEvidenceVerify("/no/such/evidence.json")).toBe(1);
    vi.restoreAllMocks();
  });
});
