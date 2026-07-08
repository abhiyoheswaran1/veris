import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectProject } from "../config/detect.js";
import type { Project } from "./model.js";
import { runChecks } from "./orchestrator.js";

const fx = (n: string) =>
  fileURLToPath(new URL(`../../test/fixtures/${n}`, import.meta.url));

describe("runChecks", () => {
  it("skips unavailable capabilities and returns a run with a verdict", async () => {
    const project = await detectProject(fx("bare-js"));
    const run = await runChecks(
      project,
      ["types", "unit", "lint"],
      project.root,
    );
    expect(run.verdict.state).toBe("partial");
    expect(run.results.every((r) => r.status === "skipped")).toBe(true);
    expect(run.env.node).toBe(process.version);
  });

  it("marks an available capability with an unregistered runner as skipped and folds it into a partial verdict", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-"));
    const project = {
      root,
      packageManager: "npm",
      frameworks: [],
      languages: ["javascript"],
      scripts: {},
      capabilities: [{ id: "lint", available: true, runner: "biome" }],
    } as Project;

    const run = await runChecks(project, ["lint"], root);

    expect(run.results).toHaveLength(1);
    const [result] = run.results;
    expect(result?.status).toBe("skipped");
    expect(result?.summary).toContain("no runner registered");
    expect(run.verdict.state).toBe("partial");
  });

  it("scopes the verdict to the requested ids, excluding available-but-unrequested capabilities", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-"));
    const project = {
      root,
      packageManager: "npm",
      frameworks: [],
      languages: ["typescript"],
      scripts: {},
      capabilities: [
        { id: "types", available: true, runner: "tsc" },
        { id: "lint", available: true, runner: "biome" },
        { id: "unit", available: false, reason: "no test runner detected" },
      ],
    } as Project;

    const run = await runChecks(project, ["lint"], project.root);

    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.checkId).toBe("lint");

    expect(run.verdict.skipped).toContain("lint");
    expect(run.verdict.skipped).not.toContain("types");
    expect(run.verdict.state).toBe("partial");
  });

  it("throws when asked to run a check id the project has no capability for", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-"));
    const project = {
      root,
      packageManager: "npm",
      frameworks: [],
      languages: [],
      scripts: {},
      capabilities: [{ id: "unit", available: false, reason: "none" }],
    } as unknown as Project;

    await expect(runChecks(project, ["types"], project.root)).rejects.toThrow(
      /Unknown check id/,
    );
  });
});
