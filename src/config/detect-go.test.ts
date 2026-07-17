import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectGo } from "./detect-go.js";

function goRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "veris-go-"));
  writeFileSync(join(root, "go.mod"), "module x\n\ngo 1.22\n");
  return root;
}

function fakeToolOnPath(name: string): { dir: string; restore: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "veris-gopath-"));
  const p = join(dir, name);
  writeFileSync(p, "#!/bin/sh\n");
  chmodSync(p, 0o755);
  const prev = process.env.PATH;
  process.env.PATH = `${dir}${process.platform === "win32" ? ";" : ":"}${prev ?? ""}`;
  return { dir, restore: () => (process.env.PATH = prev) };
}

describe("detectGo", () => {
  it("returns [] without a go.mod", () => {
    expect(detectGo(mkdtempSync(join(tmpdir(), "veris-nogo-")))).toEqual([]);
  });

  it("returns [] when go is disabled in config", () => {
    expect(detectGo(goRepo(), { languages: { go: false } })).toEqual([]);
  });

  it("emits go-test/go-build/lint capabilities when go is installed", () => {
    const { restore } = fakeToolOnPath("go");
    try {
      const caps = detectGo(goRepo());
      expect(caps.find((c) => c.id === "unit")).toMatchObject({
        language: "go",
        available: true,
        runner: "go-test",
      });
      expect(caps.find((c) => c.id === "types")?.runner).toBe("go-build");
      // no golangci-lint installed → falls back to go-vet
      expect(caps.find((c) => c.id === "lint")?.runner).toBe("go-vet");
    } finally {
      restore();
    }
  });

  it("prefers golangci-lint for lint when installed", () => {
    const go = fakeToolOnPath("go");
    const lint = fakeToolOnPath("golangci-lint");
    try {
      const caps = detectGo(goRepo());
      expect(caps.find((c) => c.id === "lint")?.runner).toBe("golangci-lint");
    } finally {
      lint.restore();
      go.restore();
    }
  });

  it("marks capabilities unavailable when the go toolchain is missing", () => {
    // Ensure 'go' is not resolvable by pointing PATH at an empty dir.
    const empty = mkdtempSync(join(tmpdir(), "veris-empty-"));
    const prev = process.env.PATH;
    process.env.PATH = empty;
    try {
      const caps = detectGo(goRepo());
      expect(caps.find((c) => c.id === "unit")?.available).toBe(false);
      expect(caps.find((c) => c.id === "unit")?.reason).toContain("go");
    } finally {
      process.env.PATH = prev;
    }
  });
});
