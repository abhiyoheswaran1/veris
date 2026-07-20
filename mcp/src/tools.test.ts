import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  attestHandler,
  doctorHandler,
  gateHandler,
  logHandler,
  scanHandler,
  verifyHandler,
} from "./tools.js";

function tinyProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "veris-mcp-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t" }));
  writeFileSync(join(dir, "a.ts"), "export const a = 1;\n");
  return dir;
}

function parse(result: { content: { text: string }[] }): unknown {
  return JSON.parse(result.content[0]?.text ?? "null");
}

describe("read-only tool handlers", () => {
  it("doctor returns capabilities and environment", async () => {
    const dir = tinyProject();
    const out = parse(await doctorHandler({ path: dir })) as {
      capabilities: unknown[];
      environment: Record<string, unknown>;
    };
    expect(Array.isArray(out.capabilities)).toBe(true);
    expect(out.environment.node).toBeDefined();
  });

  it("scan returns a graph summary with a resolver", async () => {
    const dir = tinyProject();
    const out = parse(await scanHandler({ path: dir })) as {
      resolver: string;
    };
    expect(typeof out.resolver).toBe("string");
  });

  it("log returns an empty list when there are no runs", async () => {
    const dir = tinyProject();
    const out = parse(await logHandler({ path: dir })) as { runs: unknown[] };
    expect(out.runs).toEqual([]);
  });
});

function tinyGitProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "veris-mcp-git-"));
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

describe("verify tool handler", () => {
  it("returns a verdict and per-check results", async () => {
    const dir = tinyGitProject();
    const out = parse(await verifyHandler({ path: dir })) as {
      verdict: string;
      checks: unknown[];
      digest: string;
    };
    expect(out.verdict).toBeDefined();
    expect(Array.isArray(out.checks)).toBe(true);
    expect(out.digest).toMatch(/^sha256:/);
  }, 30000);
});

// Mirrors the real project's .gitignore for `.veris/*` so a `veris_verify`
// run doesn't leave the tree "dirty" for the subsequent attest — same
// sandbox shape as src/evidence/attestation-project.test.ts.
function tinyGitProjectForAttest(): string {
  const dir = mkdtempSync(join(tmpdir(), "veris-mcp-attest-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t" }));
  writeFileSync(join(dir, "a.js"), "export const a = 1;\n");
  writeFileSync(
    join(dir, ".gitignore"),
    [
      ".veris/runs",
      ".veris/reports",
      ".veris/cache",
      ".veris/evidence",
      ".veris/keys",
      ".veris/graph.json",
      "",
    ].join("\n"),
  );
  const run = (args: string[]) => execFileSync("git", args, { cwd: dir });
  run(["init", "-q"]);
  run(["config", "user.email", "t@t.co"]);
  run(["config", "user.name", "t"]);
  run(["add", "."]);
  run(["commit", "-qm", "init"]);
  return dir;
}

describe("attest and gate tool handlers", () => {
  it("attest signs the latest verification and gate checks it against policy", async () => {
    const dir = tinyGitProjectForAttest();
    await verifyHandler({ path: dir });

    const attestOut = parse(await attestHandler({ path: dir })) as {
      path: string;
      subjectCommit: string;
      verdict: string;
      signer: string | null;
    };
    expect(attestOut.path).toBeTruthy();
    expect(attestOut.subjectCommit).toBeTruthy();
    expect(attestOut.verdict).toBeDefined();

    const gateOut = parse(await gateHandler({ path: dir })) as {
      passed: boolean;
      checks: unknown[];
    };
    expect(typeof gateOut.passed).toBe("boolean");
    expect(Array.isArray(gateOut.checks)).toBe(true);
  }, 30000);

  it("attest fails cleanly when there is no verification run", async () => {
    const dir = tinyGitProjectForAttest();
    const out = await attestHandler({ path: dir });
    expect(out.isError).toBe(true);
  }, 30000);

  it("gate fails cleanly when there is no attestation", async () => {
    const dir = tinyGitProjectForAttest();
    const out = await gateHandler({ path: dir });
    expect(out.isError).toBe(true);
  }, 30000);
});
