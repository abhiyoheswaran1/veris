import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectProject } from "../config/detect.js";
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
});
