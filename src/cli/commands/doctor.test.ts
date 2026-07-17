import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectProject } from "../../config/detect.js";
import type { EnvironmentInfo, Project } from "../../core/model.js";
import { getEnvironmentInfo } from "../../util/env.js";
import { renderDoctor } from "./doctor.js";

const fx = (n: string) =>
  fileURLToPath(new URL(`../../../test/fixtures/${n}`, import.meta.url));

describe("renderDoctor", () => {
  it("lists each capability and its runner or skip reason", async () => {
    const p = await detectProject(fx("vitest-ts"));
    const out = renderDoctor(p, getEnvironmentInfo(p.packageManager));
    expect(out).toContain("unit");
    expect(out).toContain("vitest");
    expect(out).toContain("types");
  });

  it("shows skip reasons for a bare project", async () => {
    const p = await detectProject(fx("bare-js"));
    const out = renderDoctor(p, getEnvironmentInfo(p.packageManager));
    expect(out).toContain("no test runner detected");
  });
});

describe("renderDoctor — polyglot matrix", () => {
  it("shows the language beside each capability", () => {
    const env: EnvironmentInfo = {
      os: "linux",
      node: "v24.0.0",
      pm: "npm",
      ci: false,
      timestamp: "2026-07-17T00:00:00.000Z",
    };

    const project: Project = {
      root: "/x",
      packageManager: "npm",
      frameworks: [],
      languages: ["javascript", "python"],
      scripts: {},
      capabilities: [
        { id: "unit", language: "js", available: true, runner: "vitest" },
        { id: "unit", language: "python", available: true, runner: "pytest" },
        {
          id: "lint",
          language: "python",
          available: false,
          runner: "ruff",
          reason:
            "Python detected; no lint tool installed (looked for ruff / flake8 / pylint)",
        },
      ],
    };
    const out = renderDoctor(project, env);
    expect(out).toContain("unit (js)");
    expect(out).toContain("unit (python)");
    expect(out).toContain("via pytest");
    expect(out).toContain("lint (python)");
    expect(out).toContain("skipped");
  });
});
