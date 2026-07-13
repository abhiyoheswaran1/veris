import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Capability, Project } from "../core/model.js";
import { parsePlaywrightStats, playwrightRunner } from "./playwright.js";

const project = { root: "/tmp/x", packageManager: "npm" } as Project;
const cap: Capability = {
  id: "browser",
  available: true,
  runner: "playwright",
};

describe("parsePlaywrightStats", () => {
  it("reads the stats block", () => {
    const s = parsePlaywrightStats(
      JSON.stringify({
        stats: { expected: 3, unexpected: 0, flaky: 0, skipped: 1 },
      }),
    );
    expect(s).toEqual({ expected: 3, unexpected: 0, flaky: 0, skipped: 1 });
  });
  it("returns null on non-JSON", () => {
    expect(parsePlaywrightStats("not json")).toBeNull();
  });
});

describe("playwrightRunner", () => {
  it("builds a check invoking playwright test with the json reporter", () => {
    const check = playwrightRunner.toCheck(project, cap);
    expect(check.id).toBe("browser");
    expect(check.args).toEqual(["test", "--reporter=json"]);
    expect(check.cmd).toContain(join("node_modules", ".bin", "playwright"));
  });

  it("classifies a zero exit with no unexpected as passed and sets counts", async () => {
    const runDir = mkdtempSync(join(tmpdir(), "veris-pw-"));
    const result = await playwrightRunner.run(
      {
        id: "browser",
        title: "Browser tests",
        runner: "playwright",
        cmd: process.execPath,
        args: [
          "-e",
          "process.stdout.write(JSON.stringify({stats:{expected:2,unexpected:0,flaky:0,skipped:0}}))",
        ],
      },
      { root: runDir, runDir },
    );
    expect(result.status).toBe("passed");
    expect(result.counts).toEqual({ passed: 2, failed: 0, total: 2 });
  }, 20000);

  it("does not claim passed when the output is unparseable, even on a zero exit", async () => {
    const runDir = mkdtempSync(join(tmpdir(), "veris-pw-bad-"));
    const result = await playwrightRunner.run(
      {
        id: "browser",
        title: "Browser tests",
        runner: "playwright",
        cmd: process.execPath,
        args: ["-e", "process.stdout.write('not json at all')"],
      },
      { root: runDir, runDir },
    );
    expect(result.status).toBe("unknown");
    expect(result.counts).toBeUndefined();
  }, 20000);
});
