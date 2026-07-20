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

export interface GitAnchor {
  commit: string;
  branch: string;
  dirty: boolean;
  changedFiles: number;
}

export async function gitAnchor(root: string): Promise<GitAnchor | null> {
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  if (head.code !== 0) return null; // not a repo, or no commits yet
  const commit = head.stdout.trim();

  const branchRes = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: root,
  });
  const branch = branchRes.code === 0 ? branchRes.stdout.trim() : "HEAD";

  const status = await exec("git", ["status", "--porcelain"], { cwd: root });
  const lines =
    status.code === 0
      ? status.stdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      : [];

  return {
    commit,
    branch,
    dirty: lines.length > 0,
    changedFiles: lines.length,
  };
}

// Like gitAnchor, but changes confined entirely to `.veris/attestations/`
// (VerisKit's own shareable, deliberately-not-gitignored output) do NOT count
// as dirty — so a freshly-written attestation doesn't make the tree look dirty
// to attest/gate. Source and tracked `.veris/policy.json`/`config.json` still
// trip dirty.
export async function anchorIgnoringAttestations(
  root: string,
): Promise<GitAnchor | null> {
  const anchor = await gitAnchor(root);
  if (!anchor?.dirty) return anchor;
  const cs = await changedFiles(root);
  const meaningful = cs.files.filter(
    (f) => !f.startsWith(".veris/attestations/"),
  );
  if (meaningful.length > 0) return anchor;
  return { ...anchor, dirty: false, changedFiles: 0 };
}
