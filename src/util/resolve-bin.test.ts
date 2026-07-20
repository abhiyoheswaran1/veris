import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { binExists, resolveBin } from "./resolve-bin.js";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "veris-bin-"));
}

describe("resolveBin", () => {
  it("returns the node_modules/.bin path for js", () => {
    const root = tmp();
    expect(resolveBin(root, "js", "tsc")).toBe(
      join(root, "node_modules", ".bin", "tsc"),
    );
  });

  it("prefers a .venv path for python when it exists", () => {
    const root = tmp();
    mkdirSync(join(root, ".venv", "bin"), { recursive: true });
    writeFileSync(join(root, ".venv", "bin", "pytest"), "#!/bin/sh\n");
    expect(resolveBin(root, "python", "pytest")).toBe(
      join(root, ".venv", "bin", "pytest"),
    );
  });

  it("falls back to the bare name for python without a venv", () => {
    const root = tmp();
    expect(resolveBin(root, "python", "pytest")).toBe("pytest");
  });

  it("returns the bare name for go", () => {
    expect(resolveBin(tmp(), "go", "go")).toBe("go");
  });
});

describe("binExists", () => {
  it("finds a python tool inside .venv/bin", () => {
    const root = tmp();
    const bin = join(root, ".venv", "bin");
    mkdirSync(bin, { recursive: true });
    const p = join(bin, "mypy");
    writeFileSync(p, "#!/bin/sh\n");
    chmodSync(p, 0o755);
    expect(binExists(root, "python", "mypy")).toBe(true);
  });

  it("returns false when the tool is nowhere", () => {
    expect(binExists(tmp(), "python", "definitely-not-installed-xyz")).toBe(
      false,
    );
  });

  it("finds a tool on PATH", () => {
    const root = tmp();
    const dir = mkdtempSync(join(tmpdir(), "veris-path-"));
    const p = join(dir, "faketool");
    writeFileSync(p, "#!/bin/sh\n");
    chmodSync(p, 0o755);
    const prev = process.env.PATH;
    process.env.PATH = `${dir}`;
    try {
      expect(binExists(root, "go", "faketool")).toBe(true);
    } finally {
      process.env.PATH = prev;
    }
  });
});

describe("binExists — executability", () => {
  it("returns false for a present but non-executable file (POSIX)", () => {
    if (process.platform === "win32") return; // extension implies executable on win32
    const root = tmp();
    const bin = join(root, ".venv", "bin");
    mkdirSync(bin, { recursive: true });
    const p = join(bin, "ruff");
    writeFileSync(p, "#!/bin/sh\n");
    chmodSync(p, 0o644); // not executable
    expect(binExists(root, "python", "ruff")).toBe(false);
  });

  it("returns false for a directory named like the tool", () => {
    const root = tmp();
    mkdirSync(join(root, ".venv", "bin", "pytest"), { recursive: true });
    expect(binExists(root, "python", "pytest")).toBe(false);
  });
});
