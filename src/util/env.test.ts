import { describe, expect, it } from "vitest";
import { detectCI, getEnvironmentInfo } from "./env.js";

describe("env", () => {
  it("detectCI reflects the CI env var", () => {
    const prev = process.env.CI;
    process.env.CI = "true";
    expect(detectCI()).toBe(true);
    delete process.env.CI;
    expect(detectCI()).toBe(false);
    if (prev !== undefined) process.env.CI = prev;
  });

  it("getEnvironmentInfo carries node + pm", () => {
    const info = getEnvironmentInfo("pnpm");
    expect(info.pm).toBe("pnpm");
    expect(info.node).toBe(process.version);
    expect(typeof info.timestamp).toBe("string");
  });
});
