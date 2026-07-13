import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublishContext } from "./context.js";
import { createCheckRun, GitHubApiError, upsertComment } from "./github.js";

const ctx: PublishContext = {
  owner: "acme",
  repo: "widgets",
  token: "sekret",
  prNumber: 42,
  headSha: "abc123",
};

afterEach(() => vi.unstubAllGlobals());

function mockFetch(handlers: (url: string, init: RequestInit) => unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const body = handlers(url, init);
      return { ok: true, status: 200, json: async () => body };
    }),
  );
  return calls;
}

describe("upsertComment", () => {
  it("PATCHes an existing marked comment", async () => {
    const calls = mockFetch((url, init) =>
      init.method === undefined || init.method === "GET"
        ? [{ id: 9, body: "old <!-- veriskit-report --> x" }]
        : {},
    );
    await upsertComment(ctx, "new body");
    const patch = calls.find((c) => c.init.method === "PATCH");
    expect(patch?.url).toContain("/issues/comments/9");
  });

  it("POSTs a new comment when none is marked", async () => {
    const calls = mockFetch((url, init) =>
      init.method === undefined || init.method === "GET" ? [] : {},
    );
    await upsertComment(ctx, "new body");
    const post = calls.find((c) => c.init.method === "POST");
    expect(post?.url).toContain("/issues/42/comments");
  });
});

describe("createCheckRun", () => {
  it("posts a completed check run with the conclusion", async () => {
    const calls = mockFetch(() => ({}));
    await createCheckRun(ctx, {
      name: "VerisKit",
      conclusion: "success",
      title: "VerisKit: verified",
      summary: "all good",
    });
    const post = calls.find((c) => c.init.method === "POST");
    expect(post?.url).toContain("/check-runs");
    expect(String(post?.init.body)).toContain("success");
  });
});

describe("GitHubApiError", () => {
  it("throws on a non-2xx and never includes the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })),
    );
    await expect(upsertComment(ctx, "x")).rejects.toBeInstanceOf(
      GitHubApiError,
    );
    await upsertComment(ctx, "x").catch((e: GitHubApiError) => {
      expect(e.message).not.toContain("sekret");
      expect(e.status).toBe(403);
    });
  });
});
