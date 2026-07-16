import { describe, expect, it } from "vitest";
import { checkKey, splitKey } from "./model.js";

describe("checkKey / splitKey", () => {
  it("builds a composite key", () => {
    expect(checkKey("unit", "python")).toBe("unit:python");
  });

  it("splits a composite key back into id and language", () => {
    expect(splitKey("unit:python")).toEqual({ id: "unit", language: "python" });
  });

  it("treats a bare id as js", () => {
    expect(splitKey("unit")).toEqual({ id: "unit", language: "js" });
  });

  it("round-trips every capability x language", () => {
    for (const id of ["types", "lint", "unit", "browser"] as const) {
      const k = checkKey(id, "js");
      expect(splitKey(k)).toEqual({ id, language: "js" });
    }
  });
});
