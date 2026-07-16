import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { buildRecord, canonicalize, computeDigest, sha256 } from "./record.js";

describe("canonicalize", () => {
  it("sorts object keys recursively and drops whitespace", () => {
    const a = canonicalize({ b: 1, a: { d: 2, c: 3 } });
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("is insensitive to input key insertion order", () => {
    expect(canonicalize({ x: 1, y: 2 })).toBe(canonicalize({ y: 2, x: 1 }));
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("omits undefined fields", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("sha256", () => {
  it("prefixes the hex digest with sha256:", () => {
    expect(sha256("abc")).toBe(
      "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("computeDigest", () => {
  it("ignores the existing digest field", () => {
    const base = { schema: "x", value: 1 };
    const withDigest = { ...base, digest: "sha256:stale" };
    expect(computeDigest(withDigest)).toBe(computeDigest(base));
  });

  it("changes when any real field changes", () => {
    expect(computeDigest({ value: 1 })).not.toBe(computeDigest({ value: 2 }));
  });
});

function sampleRun(): VerificationRun {
  return {
    id: "2026-07-10T00-00-00-000Z-1",
    startedAt: "2026-07-10T00:00:00.000Z",
    project: {
      root: "/tmp/demo",
      name: "demo-pkg",
      packageManager: "npm",
      frameworks: [],
      languages: ["ts"],
      scripts: {},
      capabilities: [
        { id: "unit", language: "js", available: true, runner: "vitest" },
        { id: "types", language: "js", available: true, runner: "tsc" },
      ],
    },
    results: [
      {
        checkId: "unit",
        status: "passed",
        durationMs: 1200,
        summary: "5 passed",
        counts: { passed: 5, total: 5 },
        logRef: "/tmp/demo/.veris/runs/x/unit.log",
      },
    ],
    verdict: {
      state: "verified",
      verifiedCapabilities: ["unit", "types"],
      skipped: [],
      reasons: [],
    },
    env: {
      os: "darwin",
      node: "v24.0.0",
      pm: "npm",
      ci: false,
      timestamp: "2026-07-10T00:00:00.000Z",
    },
  };
}

describe("buildRecord", () => {
  it("produces a self-consistent digest that reverifies", () => {
    const rec = buildRecord(sampleRun(), null, {}, "0.4.0");
    expect(rec.schema).toBe("veriskit/evidence@1");
    expect(rec.digest).toBe(
      computeDigest(rec as unknown as Record<string, unknown>),
    );
  });

  it("maps runner from capabilities and keeps the log digest", () => {
    const rec = buildRecord(
      sampleRun(),
      null,
      { unit: "sha256:deadbeef" },
      "0.4.0",
    );
    const unit = rec.checks.find((c) => c.id === "unit");
    expect(unit?.runner).toBe("vitest");
    expect(unit?.logDigest).toBe("sha256:deadbeef");
    expect(rec.project.name).toBe("demo-pkg");
  });

  it("defaults scope to full and never leaks absolute paths", () => {
    const rec = buildRecord(sampleRun(), null, {}, "0.4.0");
    expect(rec.scope).toEqual({ kind: "full", changedCount: 0 });
    expect(JSON.stringify(rec)).not.toContain("/tmp/demo");
  });
});
