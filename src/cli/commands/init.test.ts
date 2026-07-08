import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runInit } from "./init.js";

describe("runInit", () => {
  it("creates .veris/config.json and a gitignore, idempotently", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
    expect(await runInit(dir)).toBe(0);
    expect(existsSync(join(dir, ".veris", "config.json"))).toBe(true);
    expect(existsSync(join(dir, ".veris", ".gitignore"))).toBe(true);
    // second run must not throw or overwrite
    expect(await runInit(dir)).toBe(0);
  });
});
