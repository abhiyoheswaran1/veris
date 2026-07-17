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

describe("detectProject — polyglot", () => {
  it("adds go capabilities and language when go.mod is present", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-poly-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
    writeFileSync(join(root, "go.mod"), "module x\n\ngo 1.22\n");
    const project = await detectProject(root);
    expect(project.languages).toContain("go");
    expect(
      project.capabilities.some((c) => c.language === "go" && c.id === "unit"),
    ).toBe(true);
  });

  it("omits a disabled language entirely", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-poly2-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
    writeFileSync(join(root, "go.mod"), "module x\n\ngo 1.22\n");
    const project = await detectProject(root, { languages: { go: false } });
    expect(project.languages).not.toContain("go");
    expect(project.capabilities.some((c) => c.language === "go")).toBe(false);
  });

  it("leaves a pure-js repo's capabilities unchanged (js only)", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-js-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
    const project = await detectProject(root);
    expect(project.capabilities.every((c) => c.language === "js")).toBe(true);
    expect(project.languages).not.toContain("python");
    expect(project.languages).not.toContain("go");
  });
});
