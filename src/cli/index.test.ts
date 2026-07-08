import { describe, expect, it } from "vitest";
import { buildCli } from "./index.js";

describe("cli", () => {
  it("exposes the package version", () => {
    const cli = buildCli();
    expect(cli.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
