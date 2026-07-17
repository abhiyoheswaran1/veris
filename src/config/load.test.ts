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

describe("loadConfig — polyglot fields", () => {
  it("reads languages and tools overrides", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-cfg-"));
    mkdirSync(join(root, ".veris"), { recursive: true });
    writeFileSync(
      join(root, ".veris", "config.json"),
      JSON.stringify({
        languages: { python: true, go: false },
        tools: { python: { lint: "flake8" } },
      }),
    );
    const cfg = await loadConfig(root);
    expect(cfg?.languages?.go).toBe(false);
    expect(cfg?.tools?.python?.lint).toBe("flake8");
  });
});
