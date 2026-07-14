import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { doctorHandler, logHandler, scanHandler } from "./tools.js";

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
