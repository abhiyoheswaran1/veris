import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { buildRecord } from "../evidence/record.js";
import { createRunDir, writeEvidence } from "../evidence/store.js";
import { loadRuns } from "./read.js";

function rec(id: string, startedAt: string): ReturnType<typeof buildRecord> {
  const run = {
    id,
    startedAt,
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
    env: { os: "x", node: "v24", pm: "npm", ci: false, timestamp: startedAt },
  } as unknown as VerificationRun;
  return buildRecord(run, null, {}, "0.5.0");
}

describe("loadRuns", () => {
  it("returns records newest first and skips invalid ones", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-hist-"));
    const a = await createRunDir(root, "a");
    await writeEvidence(a, rec("a", "2026-07-10T00:00:00.000Z"));
    const b = await createRunDir(root, "b");
    await writeEvidence(b, rec("b", "2026-07-12T00:00:00.000Z"));
    const bad = await createRunDir(root, "bad");
    writeFileSync(join(bad, "evidence.json"), "{ not json");
    const runs = loadRuns(root);
    expect(runs.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("respects the limit", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-hist2-"));
    for (const [id, t] of [
      ["a", "2026-07-10T00:00:00.000Z"],
      ["b", "2026-07-11T00:00:00.000Z"],
    ] as const) {
      const d = await createRunDir(root, id);
      await writeEvidence(d, rec(id, t));
    }
    expect(loadRuns(root, 1)).toHaveLength(1);
  });
});
