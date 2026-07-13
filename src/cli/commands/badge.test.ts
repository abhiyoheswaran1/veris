import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { VerificationRun } from "../../core/model.js";
import { buildRecord } from "../../evidence/record.js";
import { createRunDir, writeEvidence } from "../../evidence/store.js";
import { runBadge } from "./badge.js";

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
    env: { os: "x", node: "v24", pm: "npm", ci: true, timestamp: "t" },
  } as unknown as VerificationRun;
  return buildRecord(run, null, {}, "0.5.0");
}

describe("runBadge", () => {
  it("writes a shields endpoint JSON from the latest run", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-badge-"));
    const dir = await createRunDir(root, "r1");
    await writeEvidence(dir, record());
    const out = join(root, "badge.json");
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await runBadge(root, { out })).toBe(0);
    expect(JSON.parse(readFileSync(out, "utf8")).message).toBe("verified");
    vi.restoreAllMocks();
  });
});
