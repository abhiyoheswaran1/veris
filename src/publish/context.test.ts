import { describe, expect, it } from "vitest";
import { resolvePublishContext } from "./context.js";

const base = {
  GITHUB_REPOSITORY: "acme/widgets",
  GITHUB_TOKEN: "t0ken",
  GITHUB_REF: "refs/pull/42/merge",
  GITHUB_SHA: "deadbeef",
} as NodeJS.ProcessEnv;

describe("resolvePublishContext", () => {
  it("builds a context from a pull_request ref", () => {
    const ctx = resolvePublishContext(base, () => null);
    expect(ctx).toEqual({
      owner: "acme",
      repo: "widgets",
      token: "t0ken",
      prNumber: 42,
      headSha: "deadbeef",
    });
  });

  it("prefers the event payload head sha and number", () => {
    const env = { ...base, GITHUB_REF: "refs/heads/x" } as NodeJS.ProcessEnv;
    const ctx = resolvePublishContext(env, () => ({
      pull_request: { number: 7, head: { sha: "abc123" } },
    }));
    expect(ctx?.prNumber).toBe(7);
    expect(ctx?.headSha).toBe("abc123");
  });

  it("returns null without a token", () => {
    const env = { ...base } as NodeJS.ProcessEnv;
    env.GITHUB_TOKEN = undefined;
    expect(resolvePublishContext(env, () => null)).toBeNull();
  });

  it("returns null when there is no PR", () => {
    const env = { ...base, GITHUB_REF: "refs/heads/main" } as NodeJS.ProcessEnv;
    expect(resolvePublishContext(env, () => null)).toBeNull();
  });
});
