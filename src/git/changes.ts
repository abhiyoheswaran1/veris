import { exec } from "../util/exec.js";

export interface ChangeSet {
  files: string[];
  base: string | null; // null => working tree vs HEAD
}

function collect(set: Set<string>, out: string): void {
  for (const line of out.split("\n")) {
    const f = line.trim();
    if (f) set.add(f);
  }
}

export async function changedFiles(
  root: string,
  opts: { base?: string } = {},
): Promise<ChangeSet> {
  const base = opts.base ?? null;
  const files = new Set<string>();

  const diffArgs = base
    ? ["diff", "--name-only", base]
    : ["diff", "--name-only", "HEAD"];
  const diff = await exec("git", diffArgs, { cwd: root });
  if (diff.code === 0) collect(files, diff.stdout);

  const untracked = await exec(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { cwd: root },
  );
  if (untracked.code === 0) collect(files, untracked.stdout);

  return { files: [...files].sort(), base };
}
