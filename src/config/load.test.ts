import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./load.js";

describe("loadConfig", () => {
  it("returns null when no config present", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-"));
    expect(await loadConfig(dir)).toBeNull();
  });

  it("reads .veris/config.json when present", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-"));
    const cfgDir = join(dir, ".veris");
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(
      join(cfgDir, "config.json"),
      JSON.stringify({ checks: ["unit"] }),
    );
    const cfg = await loadConfig(dir);
    expect(cfg?.checks).toEqual(["unit"]);
  });
});
