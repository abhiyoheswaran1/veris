import { readFileSync } from "node:fs";

export interface PublishContext {
  owner: string;
  repo: string;
  token: string;
  prNumber: number;
  headSha: string;
}

function defaultReadEvent(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function resolvePublishContext(
  env: NodeJS.ProcessEnv = process.env,
  readEvent: (path: string) => unknown = defaultReadEvent,
): PublishContext | null {
  const repository = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  if (!repository || !token) return null;
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return null;

  let prNumber: number | null = null;
  let headSha = env.GITHUB_SHA ?? "";

  const refMatch = (env.GITHUB_REF ?? "").match(/^refs\/pull\/(\d+)\//);
  if (refMatch) prNumber = Number(refMatch[1]);

  const event = readEvent(env.GITHUB_EVENT_PATH ?? "") as {
    pull_request?: { number?: number; head?: { sha?: string } };
  } | null;
  const pr = event?.pull_request;
  if (pr) {
    if (prNumber === null && typeof pr.number === "number") {
      prNumber = pr.number;
    }
    if (pr.head?.sha) headSha = pr.head.sha;
  }

  if (prNumber === null || !headSha) return null;
  return { owner, repo, token, prNumber, headSha };
}
