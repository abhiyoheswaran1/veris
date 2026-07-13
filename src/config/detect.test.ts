import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectProject } from "./detect.js";

const fx = (name: string) =>
  fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url));

const cap = (p: Awaited<ReturnType<typeof detectProject>>, id: string) =>
  // biome-ignore lint/style/noNonNullAssertion: test helper, fixtures guarantee the capability exists
  p.capabilities.find((c) => c.id === id)!;

describe("detectProject", () => {
  it("detects vitest, tsc, and biome in a TS project", async () => {
    const p = await detectProject(fx("vitest-ts"));
    expect(cap(p, "unit")).toMatchObject({ available: true, runner: "vitest" });
    expect(cap(p, "types")).toMatchObject({ available: true, runner: "tsc" });
    expect(cap(p, "lint")).toMatchObject({ available: true, runner: "biome" });
  });

  it("marks capabilities unavailable with a reason in a bare JS project", async () => {
    const p = await detectProject(fx("bare-js"));
    expect(cap(p, "unit").available).toBe(false);
    expect(cap(p, "unit").reason).toBeTruthy();
    expect(cap(p, "types").available).toBe(false);
    expect(cap(p, "lint").available).toBe(false);
  });
});

describe("detectBrowser", () => {
  it("marks browser available with the playwright runner when a config exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-pw-detect-"));
    writeFileSync(join(dir, "playwright.config.ts"), "export default {};\n");
    const project = await detectProject(dir);
    const browser = project.capabilities.find((c) => c.id === "browser");
    expect(browser?.available).toBe(true);
    expect(browser?.runner).toBe("playwright");
  });

  it("marks browser unavailable without playwright", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-nopw-"));
    const project = await detectProject(dir);
    const browser = project.capabilities.find((c) => c.id === "browser");
    expect(browser?.available).toBe(false);
  });
});
