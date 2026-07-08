import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRunDir, newRunId, writeLog, writeReport } from "./store.js";

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
