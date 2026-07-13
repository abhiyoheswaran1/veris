import { describe, expect, it } from "vitest";
import type { Verdict } from "../core/model.js";
import { buildBadge } from "./badge.js";

function verdict(state: Verdict["state"]): Verdict {
  return { state, verifiedCapabilities: [], skipped: [], reasons: [] };
}

describe("buildBadge", () => {
  it("maps verified to teal", () => {
    expect(buildBadge(verdict("verified"))).toEqual({
      schemaVersion: 1,
      label: "veriskit",
      message: "verified",
      color: "14b8a6",
    });
  });
  it("maps failed to red and partial to amber", () => {
    expect(buildBadge(verdict("failed")).color).toBe("e5484d");
    expect(buildBadge(verdict("partial")).message).toBe("partial");
  });
});
