import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { buildRecord } from "../evidence/record.js";
import { renderMarkdown } from "./markdown.js";

const run: VerificationRun = {
  id: "abc",
  startedAt: "2026-07-08T00:00:00.000Z",
  project: {
    root: "/x",
    packageManager: "npm",
    frameworks: [],
    languages: ["typescript"],
    scripts: {},
    capabilities: [],
  },
  results: [
    {
      checkId: "types",
      status: "passed",
      durationMs: 4200,
      summary: "no type errors",
      logRef: "/x/.veris/runs/abc/types.log",
    },
    {
      checkId: "unit",
      status: "failed",
      durationMs: 1200,
      summary: "unit tests failed | see log",
      logRef: "/x/.veris/runs/abc/unit.log",
      outputTail: "FAIL src/a.test.ts\nexpected 1 to be 2",
    },
    {
      checkId: "lint",
      status: "skipped",
      durationMs: 0,
      summary: "no linter configured",
    },
  ],
  verdict: {
    state: "failed",
    verifiedCapabilities: ["types"],
    skipped: ["lint"],
    reasons: ["lint skipped — no linter configured"],
  },
  env: {
    os: "darwin",
    node: "v26.0.0",
    pm: "npm",
    ci: false,
    timestamp: "2026-07-08T00:00:00.000Z",
  },
};

describe("renderMarkdown", () => {
  it("includes verdict, each check, and the skipped list with reasons", () => {
    const md = renderMarkdown(run);
    expect(md).toContain("# VerisKit Verification Report");
    expect(md).toContain("types");
    expect(md).toContain("no linter configured");
    expect(md).toContain("v26.0.0");
  });

  it("references per-check logs relative to the project root", () => {
    const md = renderMarkdown(run);
    expect(md).toContain(".veris/runs/abc/types.log");
  });

  it("escapes pipe characters in summary cells", () => {
    const md = renderMarkdown(run);
    expect(md).toContain("unit tests failed \\| see log");
  });

  it("renders failed outputTail in a Failure output code block", () => {
    const md = renderMarkdown(run);
    expect(md).toContain("## Failure output");
    expect(md).toContain("### unit");
    expect(md).toContain("expected 1 to be 2");
  });

  it("renders the git anchor and evidence digest when a record is given", () => {
    const record = buildRecord(
      run,
      {
        commit: "4fa33a9aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        branch: "main",
        dirty: false,
        changedFiles: 0,
      },
      {},
      "0.4.0",
    );
    const md = renderMarkdown(run, record);
    expect(md).toContain("**Commit:** 4fa33a9 (main)");
    expect(md).toContain("tree clean");
    expect(md).toContain(record.digest);
    expect(md).toContain("Integrity digest");
    expect(md).toContain("not forgery-proof");
  });
});

describe("renderMarkdown — polyglot", () => {
  it("qualifies the Check column with the language across languages", () => {
    const polyRun = {
      id: "p",
      startedAt: "2026-07-17T00:00:00.000Z",
      project: {
        root: "/x",
        packageManager: "npm",
        frameworks: [],
        languages: ["javascript", "go"],
        scripts: {},
        capabilities: [],
      },
      results: [
        { checkId: "unit:js", status: "passed", durationMs: 100, summary: "" },
        {
          checkId: "unit:go",
          status: "failed",
          durationMs: 100,
          summary: "",
          outputTail: "FAIL x_test.go",
        },
      ],
      verdict: {
        state: "failed",
        verifiedCapabilities: ["unit:js"],
        skipped: [],
        reasons: [],
      },
      env: {
        os: "linux",
        node: "v24",
        pm: "npm",
        ci: false,
        timestamp: "2026-07-17T00:00:00.000Z",
      },
    } as unknown as import("../core/model.js").VerificationRun;
    const out = renderMarkdown(polyRun);
    expect(out).toContain("unit (js)");
    expect(out).toContain("unit (go)");
    // failure heading also qualified
    expect(out).toContain("### unit (go)");
  });
});
