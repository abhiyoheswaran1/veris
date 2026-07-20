import { readFileSync } from "node:fs";
import {
  buildAttestation,
  signAttestation,
} from "../../evidence/attestation.js";
import { signatureKeyId } from "../../evidence/signing.js";
import { readLatestRecord, writeAttestation } from "../../evidence/store.js";

export async function runAttest(
  root: string,
  opts: { key?: string; out?: string } = {},
): Promise<number> {
  const record = await readLatestRecord(root);
  if (!record) {
    process.stderr.write(
      "veris: no verification run found — run `veris verify` first.\n",
    );
    return 1;
  }
  if (!record.git) {
    process.stderr.write("veris: cannot attest outside a git repository.\n");
    return 1;
  }
  if (record.git.dirty) {
    process.stderr.write(
      "veris: cannot attest a dirty tree — commit or stash first.\n",
    );
    return 1;
  }

  let privateKeyPem: string | undefined;
  if (process.env.VERISKIT_SIGNING_KEY) {
    privateKeyPem = process.env.VERISKIT_SIGNING_KEY;
  } else if (opts.key) {
    try {
      privateKeyPem = readFileSync(opts.key, "utf8");
    } catch {
      process.stderr.write(`veris: cannot read signing key at ${opts.key}\n`);
      return 1;
    }
  }

  let att = buildAttestation(record);
  if (privateKeyPem) att = signAttestation(att, privateKeyPem);

  let ref: string;
  if (opts.out) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(opts.out, `${JSON.stringify(att, null, 2)}\n`, "utf8");
    ref = opts.out;
  } else {
    ref = await writeAttestation(root, record.id, att);
  }

  const signer = att.signature
    ? `signed by ${signatureKeyId(att.signature)}`
    : "unsigned (set VERISKIT_SIGNING_KEY or pass --key to sign)";
  process.stdout.write(
    [
      `Attestation ${ref}`,
      `Subject     ${record.git.commit.slice(0, 7)} · verdict ${record.verdict.state}`,
      `Signature   ${signer}`,
      "",
    ].join("\n"),
  );
  return 0;
}
