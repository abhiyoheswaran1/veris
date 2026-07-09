import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { changedFiles } from "./changes.js";

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "veris-git-"));
  const run = (args: string[]) => execFileSync("git", args, { cwd: dir });
  run(["init", "-q"]);
  run(["config", "user.email", "t@t.dev"]);
  run(["config", "user.name", "t"]);
  writeFileSync(join(dir, "a.ts"), "export const a = 1;\n");
  run(["add", "."]);
  run(["commit", "-q", "-m", "init"]);
  return dir;
}

describe("changedFiles", () => {
  it("reports tracked modifications vs HEAD", async () => {
    const dir = initRepo();
    writeFileSync(join(dir, "a.ts"), "export const a = 2;\n");
    const cs = await changedFiles(dir);
    expect(cs.files).toContain("a.ts");
    expect(cs.base).toBeNull();
  });

  it("reports untracked files", async () => {
    const dir = initRepo();
    writeFileSync(join(dir, "b.ts"), "export const b = 3;\n");
    const cs = await changedFiles(dir);
    expect(cs.files).toContain("b.ts");
  });

  it("returns an empty set for a clean tree", async () => {
    const dir = initRepo();
    const cs = await changedFiles(dir);
    expect(cs.files).toEqual([]);
  });
});
