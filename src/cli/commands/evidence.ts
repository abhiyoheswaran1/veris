import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import pc from "picocolors";
import { buildBundle } from "../../evidence/bundle.js";
import type { EvidenceRecord } from "../../evidence/record.js";
import { computeDigest } from "../../evidence/record.js";
import type { Signature } from "../../evidence/signing.js";
import { generateKeyPair, signDigest } from "../../evidence/signing.js";
import {
  ensureEvidenceDir,
  latestRunDir,
  readRunLogs,
} from "../../evidence/store.js";
import { verifyEvidenceFile } from "../../evidence/verify-evidence.js";
import { isPlain } from "../tty.js";

const HONESTY =
  "An integrity digest confirms the record was not edited or corrupted since it was written.\n" +
  "It is not forgery-proof on its own: publish the digest separately (CI log, PR) or sign it (veris evidence sign) to prove authorship.";

export async function runEvidenceVerify(
  path: string,
  opts: { pubkey?: string; keyId?: string; sig?: string } = {},
): Promise<number> {
  let expectedPubKeyPem: string | undefined;
  if (opts.pubkey) {
    try {
      expectedPubKeyPem = readFileSync(opts.pubkey, "utf8");
    } catch {
      process.stderr.write(`veris: cannot read public key at ${opts.pubkey}\n`);
      return 1;
    }
  }

  let result: Awaited<ReturnType<typeof verifyEvidenceFile>>;
  try {
    result = await verifyEvidenceFile(path, {
      sigPath: opts.sig,
      expectedKeyId: opts.keyId,
      expectedPubKeyPem,
    });
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
    `\n${result.ok ? "digest OK" : "TAMPERED"} · verdict ${result.record.verdict.state} · ${anchor}\n`,
  );
  process.stdout.write(`\n${HONESTY}\n`);
  if (result.signed && !opts.pubkey && !opts.keyId) {
    process.stdout.write(
      "\nThis record is signed. Confirm you trust the signing key by comparing its\nkey id above to one you already trust, or re-run with --pubkey / --key-id.\n",
    );
  }
  return result.ok ? 0 : 1;
}

export async function runEvidenceKeygen(
  root: string,
  opts: { out?: string } = {},
): Promise<number> {
  const out = opts.out ?? join(root, ".veris", "keys", "veriskit-signing.key");
  const pub = `${out}.pub`;
  if (existsSync(out) || existsSync(pub)) {
    process.stderr.write(
      `veris: a key already exists at ${out}. Refusing to overwrite it.\n`,
    );
    return 1;
  }
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dirname(out), { recursive: true });

  const kp = generateKeyPair();
  writeFileSync(out, kp.privateKeyPem, { mode: 0o600 });
  chmodSync(out, 0o600);
  writeFileSync(pub, kp.publicKeyPem, "utf8");

  process.stdout.write(
    [
      `Wrote signing key ${out} (keep this secret; do not commit it)`,
      `Wrote public key ${pub}`,
      `Key id ${kp.keyId}`,
      "",
    ].join("\n"),
  );
  return 0;
}

export async function runEvidenceSign(
  evidencePath: string,
  opts: { key?: string; out?: string } = {},
): Promise<number> {
  let privateKeyPem: string;
  if (process.env.VERISKIT_SIGNING_KEY) {
    privateKeyPem = process.env.VERISKIT_SIGNING_KEY;
  } else if (opts.key) {
    try {
      privateKeyPem = readFileSync(opts.key, "utf8");
    } catch {
      process.stderr.write(`veris: cannot read signing key at ${opts.key}\n`);
      return 1;
    }
  } else {
    process.stderr.write(
      "veris: no signing key. Pass --key <path> or set VERISKIT_SIGNING_KEY.\n",
    );
    return 1;
  }

  let record: EvidenceRecord;
  try {
    record = JSON.parse(readFileSync(evidencePath, "utf8")) as EvidenceRecord;
  } catch {
    process.stderr.write(`veris: cannot read evidence at ${evidencePath}\n`);
    return 1;
  }

  const recomputed = computeDigest(
    record as unknown as Record<string, unknown>,
  );
  if (recomputed !== record.digest) {
    process.stderr.write(
      "veris: refusing to sign, the record digest does not match its contents.\n",
    );
    return 1;
  }

  let sig: ReturnType<typeof signDigest>;
  try {
    sig = signDigest(record.digest, privateKeyPem);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`veris: signing failed: ${msg}\n`);
    return 1;
  }

  const out = opts.out ?? `${evidencePath}.sig`;
  writeFileSync(out, `${JSON.stringify(sig, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Signed ${evidencePath}\nWrote ${out} (key ${sig.keyId})\n`,
  );
  return 0;
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

  let signature: Signature | undefined;
  const sigPath = join(runDir, "evidence.json.sig");
  if (existsSync(sigPath)) {
    try {
      signature = JSON.parse(readFileSync(sigPath, "utf8")) as Signature;
    } catch {
      // ignore an unreadable signature; bundle stays unsigned
    }
  }

  const bundle = buildBundle(record, report, logs, signature);
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
