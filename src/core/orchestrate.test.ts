import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Project } from "./model.js";
import {
  affectedProject,
  resolveChecks,
  verifyProject,
} from "./orchestrate.js";

function project(browserAvailable: boolean): Project {
  return {
    root: "/x",
    packageManager: "npm",
    frameworks: [],
    languages: [],
    scripts: {},
    capabilities: [
      { id: "unit", language: "js", available: true, runner: "vitest" },
      {
        id: "browser",
        language: "js",
        available: browserAvailable,
        runner: "playwright",
      },
    ],
  };
}

describe("resolveChecks", () => {
  it("uses the default set by default", () => {
    expect(resolveChecks(undefined, project(true), {})).toEqual([
      "types",
      "lint",
      "unit",
    ]);
  });
  it("appends browser only when --browser and available", () => {
    expect(
      resolveChecks(undefined, project(true), { browser: true }),
    ).toContain("browser");
    expect(
      resolveChecks(undefined, project(false), { browser: true }),
    ).not.toContain("browser");
  });
});

describe("verifyProject / affectedProject on a tiny git repo", () => {
  function tinyRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), "veris-orch-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t" }));
    writeFileSync(join(dir, "a.js"), "export const a = 1;\n");
    const run = (args: string[]) => execFileSync("git", args, { cwd: dir });
    run(["init", "-q"]);
    run(["config", "user.email", "t@t.co"]);
    run(["config", "user.name", "t"]);
    run(["add", "."]);
    run(["commit", "-qm", "init"]);
    return dir;
  }

  it("verifyProject returns a run and a matching record", async () => {
    const dir = tinyRepo();
    const { run, record } = await verifyProject(dir);
    expect(run.verdict.state).toBeDefined();
    expect(record.digest).toMatch(/^sha256:/);
    expect(record.id).toBe(run.id);
  }, 30000);

  it("affectedProject reports nothing affected on a clean tree", async () => {
    const dir = tinyRepo();
    const outcome = await affectedProject(dir);
    expect(outcome.nothingAffected).toBe(true);
    expect(outcome.note).toContain("Nothing affected");
  }, 30000);

  it("verifyProject does not count an untracked attestation as dirty", async () => {
    const dir = tinyRepo();
    mkdirSync(join(dir, ".veris", "attestations"), { recursive: true });
    writeFileSync(
      join(dir, ".veris", "attestations", "x.att.json"),
      JSON.stringify({ fake: true }),
    );
    const { record } = await verifyProject(dir);
    expect(record.git?.dirty).toBe(false);
  }, 30000);

  it("verifyProject records dirty when a real source file is dirty", async () => {
    const dir = tinyRepo();
    writeFileSync(join(dir, "a.js"), "export const a = 2;\n");
    const { record } = await verifyProject(dir);
    expect(record.git?.dirty).toBe(true);
  }, 30000);
});
