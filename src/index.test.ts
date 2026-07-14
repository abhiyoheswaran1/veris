import { describe, expect, it } from "vitest";
import * as api from "./index.js";

describe("veriskit public API", () => {
  it("exports the core functions the MCP server needs", () => {
    for (const name of [
      "verifyProject",
      "affectedProject",
      "detectProject",
      "buildGraph",
      "analyze",
      "loadRuns",
      "detectFlaky",
      "verifyEvidenceFile",
      "getEnvironmentInfo",
    ]) {
      expect(typeof (api as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
