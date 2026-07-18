import { describe, expect, it } from "vitest";
import type { CheckResult } from "../core/model.js";
import { checkLabel, runSpansLanguages } from "./label.js";

const r = (checkId: string): CheckResult => ({
  checkId,
  status: "passed",
  durationMs: 1,
  summary: "",
});

describe("runSpansLanguages", () => {
  it("is false for a single-language run", () => {
    expect(runSpansLanguages([r("unit:js"), r("types:js")])).toBe(false);
  });
  it("is true when more than one language is present", () => {
    expect(runSpansLanguages([r("unit:js"), r("unit:python")])).toBe(true);
  });
});

describe("checkLabel", () => {
  it("returns the bare capability id when not showing language", () => {
    expect(checkLabel("unit:js", false)).toBe("unit");
  });
  it("qualifies with the language when showing language", () => {
    expect(checkLabel("unit:python", true)).toBe("unit (python)");
  });
});
