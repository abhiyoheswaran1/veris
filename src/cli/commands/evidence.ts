import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import pc from "picocolors";
import { buildBundle } from "../../evidence/bundle.js";
import type { EvidenceRecord } from "../../evidence/record.js";
import {
  ensureEvidenceDir,
  latestRunDir,
  readRunLogs,
} from "../../evidence/store.js";
import { verifyEvidenceFile } from "../../evidence/verify-evidence.js";
import { isPlain } from "../tty.js";

const HONESTY =
  "An integrity digest confirms the record was not edited or corrupted since it was written.\n" +
  "It is not forgery-proof on its own: publish the digest separately (CI log, PR) or sign it (planned) to prove authorship.";

export async function runEvidenceVerify(path: string): Promise<number> {
  let result: Awaited<ReturnType<typeof verifyEvidenceFile>>;
  try {
    result = await verifyEvidenceFile(path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`veris: cannot read evidence at ${path}: ${msg}\n`);
    return 1;
  }

  const plain = isPlain();
  const mark = (ok: boolean) =>
    plain ? (ok ? "ok" : "FAIL") : ok ? pc.green("✓") : pc.red("✗");

  for (const check of result.checks) {
    process.stdout.write(
      `  ${mark(check.ok)} ${check.name}: ${check.detail}\n`,
    );
  }

  const g = result.record.git;
  const anchor = g
    ? `commit ${g.commit.slice(0, 7)} · ${g.dirty ? "tree dirty" : "tree clean"}`
    : "no git anchor";
  process.stdout.write(
    `\n${result.ok ? "verified" : "TAMPERED"} · ${result.record.verdict.state} · ${anchor}\n`,
  );
  process.stdout.write(`\n${HONESTY}\n`);
  return result.ok ? 0 : 1;
}

export async function runEvidenceBundle(
  root: string,
  opts: { out?: string } = {},
): Promise<number> {
  const runDir = latestRunDir(root);
  if (!runDir) {
    process.stdout.write("No evidence yet. Run `veris verify` first.\n");
    return 1;
  }
  let record: EvidenceRecord;
  try {
    record = JSON.parse(
      readFileSync(join(runDir, "evidence.json"), "utf8"),
    ) as EvidenceRecord;
  } catch {
    process.stderr.write(`veris: no evidence.json in ${runDir}\n`);
    return 1;
  }

  let report = "";
  try {
    report = readFileSync(
      join(root, ".veris", "reports", `verify-${record.id}.md`),
      "utf8",
    );
  } catch {
    // report is optional in a bundle
  }

  const logIds = record.checks
    .filter((c) => c.logDigest)
    .map((c) => c.id as string);
  const logs = await readRunLogs(runDir, logIds);

  const bundle = buildBundle(record, report, logs);
  const outDir = await ensureEvidenceDir(root);
  const out = opts.out ?? join(outDir, `${record.id}.bundle.json`);
  await writeFile(out, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote portable evidence bundle: ${out}\n`);
  return 0;
}

export async function runEvidenceShow(
  root: string,
  path?: string,
): Promise<number> {
  const target =
    path ??
    (() => {
      const dir = latestRunDir(root);
      return dir ? join(dir, "evidence.json") : null;
    })();
  if (!target) {
    process.stdout.write("No evidence yet. Run `veris verify` first.\n");
    return 0;
  }
  let record: EvidenceRecord;
  try {
    record = JSON.parse(readFileSync(target, "utf8")) as EvidenceRecord;
  } catch {
    process.stderr.write(`veris: cannot read evidence at ${target}\n`);
    return 1;
  }
  const g = record.git;
  process.stdout.write(
    [
      `Evidence   ${basename(target)}`,
      `Verdict    ${record.verdict.state}`,
      `Project    ${record.project.name}`,
      `Scope      ${record.scope.kind} (${record.scope.changedCount} changed)`,
      `Commit     ${g ? `${g.commit.slice(0, 7)} (${g.branch}) ${g.dirty ? "· tree dirty" : "· tree clean"}` : "no git anchor"}`,
      `Checks     ${record.checks.map((c) => `${c.id}:${c.status}`).join(", ")}`,
      `Digest     ${record.digest}`,
      "",
    ].join("\n"),
  );
  return 0;
}
