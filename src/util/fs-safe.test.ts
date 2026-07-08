import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureDir, readJsonIfExists, writeIfAbsent } from "./fs-safe.js";

describe("fs-safe", () => {
  it("writeIfAbsent writes once and refuses to overwrite", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-"));
    const f = join(dir, "a.txt");
    expect(await writeIfAbsent(f, "first")).toBe(true);
    expect(await writeIfAbsent(f, "second")).toBe(false);
    expect(readFileSync(f, "utf8")).toBe("first");
  });

  it("readJsonIfExists returns null when missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-"));
    expect(await readJsonIfExists(join(dir, "none.json"))).toBeNull();
  });

  it("ensureDir is idempotent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-"));
    const nested = join(dir, "x", "y");
    await ensureDir(nested);
    await ensureDir(nested);
    expect(await writeIfAbsent(join(nested, "z.txt"), "ok")).toBe(true);
  });
});
