import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectPython } from "./detect-python.js";

function pyRepo(markers: string[] = ["pyproject.toml"]): string {
  const root = mkdtempSync(join(tmpdir(), "veris-py-"));
  for (const m of markers) writeFileSync(join(root, m), "");
  return root;
}

function installVenvTool(root: string, name: string): void {
  const bin = join(root, ".venv", "bin");
  mkdirSync(bin, { recursive: true });
  const p = join(bin, name);
  writeFileSync(p, "#!/bin/sh\n");
  chmodSync(p, 0o755);
}

describe("detectPython", () => {
  it("returns [] when there is no python marker", () => {
    const root = mkdtempSync(join(tmpdir(), "veris-none-"));
    expect(detectPython(root)).toEqual([]);
  });

  it("returns [] when python is disabled in config", () => {
    const root = pyRepo();
    expect(detectPython(root, { languages: { python: false } })).toEqual([]);
  });

  it("marks unit available with pytest when pytest is installed", () => {
    const root = pyRepo();
    installVenvTool(root, "pytest");
    const caps = detectPython(root);
    const unit = caps.find((c) => c.id === "unit");
    expect(unit).toMatchObject({
      id: "unit",
      language: "python",
      available: true,
      runner: "pytest",
    });
  });

  it("marks unit unavailable with a reason when pytest is missing", () => {
    const root = pyRepo();
    const unit = detectPython(root).find((c) => c.id === "unit");
    expect(unit?.available).toBe(false);
    expect(unit?.reason).toContain("pytest");
  });

  it("prefers mypy over pyright for types", () => {
    const root = pyRepo();
    installVenvTool(root, "mypy");
    installVenvTool(root, "pyright");
    const types = detectPython(root).find((c) => c.id === "types");
    expect(types?.runner).toBe("mypy");
  });

  it("honors a tools override for lint", () => {
    const root = pyRepo();
    installVenvTool(root, "flake8");
    const lint = detectPython(root, {
      tools: { python: { lint: "flake8" } },
    }).find((c) => c.id === "lint");
    expect(lint).toMatchObject({ runner: "flake8", available: true });
  });

  it("detects via requirements.txt too", () => {
    const root = pyRepo(["requirements.txt"]);
    expect(detectPython(root).length).toBe(3);
  });
});
