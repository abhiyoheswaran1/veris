import { describe, expect, it } from "vitest";
import { canonicalize, computeDigest, sha256 } from "./record.js";

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
