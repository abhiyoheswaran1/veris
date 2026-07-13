import { MARKER } from "./comment.js";
import type { PublishContext } from "./context.js";

export class GitHubApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "veriskit",
    "Content-Type": "application/json",
  };
}

async function gh(
  method: string,
  url: string,
  token: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: headers(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    // The token is never included; only method, path, and status.
    const path = url.replace("https://api.github.com", "");
    throw new GitHubApiError(
      res.status,
      `GitHub API ${method} ${path} -> ${res.status}`,
    );
  }
  return res.json();
}

function repoBase(ctx: PublishContext): string {
  return `https://api.github.com/repos/${ctx.owner}/${ctx.repo}`;
}

export async function upsertComment(
  ctx: PublishContext,
  body: string,
): Promise<void> {
  const base = repoBase(ctx);
  const comments = (await gh(
    "GET",
    `${base}/issues/${ctx.prNumber}/comments?per_page=100`,
    ctx.token,
  )) as Array<{ id: number; body?: string }>;
  const existing = comments.find((c) => (c.body ?? "").includes(MARKER));
  if (existing) {
    await gh("PATCH", `${base}/issues/comments/${existing.id}`, ctx.token, {
      body,
    });
  } else {
    await gh("POST", `${base}/issues/${ctx.prNumber}/comments`, ctx.token, {
      body,
    });
  }
}

export async function createCheckRun(
  ctx: PublishContext,
  opts: { name: string; conclusion: string; title: string; summary: string },
): Promise<void> {
  await gh("POST", `${repoBase(ctx)}/check-runs`, ctx.token, {
    name: opts.name,
    head_sha: ctx.headSha,
    status: "completed",
    conclusion: opts.conclusion,
    output: { title: opts.title, summary: opts.summary },
  });
}
