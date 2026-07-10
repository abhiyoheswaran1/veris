import { describe, expect, it } from "vitest";
import {
  hasClassicApi,
  loadTypeScript,
  selectResolver,
} from "./ts-resolver.js";

describe("ts-resolver", () => {
  it("loads the project's own typescript from the repo root", () => {
    const ts = loadTypeScript(process.cwd());
    expect(ts).not.toBeNull();
    expect(typeof ts?.preProcessFile).toBe("function");
  });

  it("selects the typescript resolver for a repo that has TS + tsconfig", () => {
    const choice = selectResolver(process.cwd());
    expect(choice.resolver).toBe("typescript");
    // resolve this very file's imports — should include a real intra-repo path
    const imps = choice.importsOf("src/project-graph/graph.ts");
    expect(imps.some((i) => i.startsWith("src/project-graph/"))).toBe(true);
  });

  it("falls back to the scanner when a dir has no tsconfig", () => {
    const choice = selectResolver("/nonexistent-veris-root");
    expect(choice.resolver).toBe("scanner");
  });

  it("hasClassicApi returns false for a TS 7.x-style native stub", () => {
    expect(hasClassicApi({ version: "7.0.0", versionMajorMinor: "7.0" })).toBe(
      false,
    );
  });

  it("hasClassicApi returns false for null", () => {
    expect(hasClassicApi(null)).toBe(false);
  });

  it("hasClassicApi returns true for the real (classic-API) typescript module", () => {
    const ts = loadTypeScript(process.cwd());
    expect(hasClassicApi(ts)).toBe(true);
  });
});
