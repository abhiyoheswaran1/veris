import { readFileSync } from "node:fs";
import pc from "picocolors";
import type { Attestation } from "../../evidence/attestation.js";
import { keyId } from "../../evidence/signing.js";
import { latestAttestation } from "../../evidence/store.js";
import { anchorIgnoringAttestations } from "../../git/changes.js";
import {
  evaluatePolicy,
  loadPolicy,
  loadPolicyFile,
  type Policy,
} from "../../policy/policy.js";
import { readJsonIfExists } from "../../util/fs-safe.js";
import { isPlain } from "../tty.js";

export async function runGate(
  root: string,
  opts: {
    policy?: string;
    attestation?: string;
    pubkey?: string;
    keyId?: string;
  } = {},
): Promise<number> {
  let policy: Policy;
  try {
    policy = opts.policy
      ? await loadPolicyFile(opts.policy)
      : await loadPolicy(root);
  } catch (err) {
    process.stderr.write(
      `veris: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  let att: Attestation;
  if (opts.attestation) {
    const loaded = await readJsonIfExists<Attestation>(opts.attestation);
    if (!loaded) {
      process.stderr.write(
        `veris: cannot read attestation at ${opts.attestation}\n`,
      );
      return 1;
    }
    att = loaded;
  } else {
    const found = latestAttestation(root);
    if (!found) {
      process.stderr.write(
        "veris: no attestation found — run `veris attest`.\n",
      );
      return 1;
    }
    att = found.att;
  }

  let pubKeyId: string | undefined;
  if (opts.pubkey) {
    try {
      pubKeyId = keyId(readFileSync(opts.pubkey, "utf8"));
    } catch {
      process.stderr.write(`veris: cannot read public key at ${opts.pubkey}\n`);
      return 1;
    }
  } else if (opts.keyId) {
    pubKeyId = opts.keyId;
  }

  const git = await anchorIgnoringAttestations(root);
  let result: ReturnType<typeof evaluatePolicy>;
  try {
    result = evaluatePolicy(att, policy, git, { pubKeyId });
  } catch {
    process.stderr.write("veris: malformed attestation\n");
    return 1;
  }

  const plain = isPlain();
  const mark = (ok: boolean) =>
    plain ? (ok ? "ok" : "FAIL") : ok ? pc.green("✓") : pc.red("✗");
  process.stdout.write("Gate checks\n");
  for (const c of result.checks) {
    process.stdout.write(`  ${mark(c.ok)} ${c.label}: ${c.reason}\n`);
  }
  const label = result.passed ? "Gate: passed" : "Gate: FAILED";
  process.stdout.write(
    `\n${plain ? label : result.passed ? pc.green(label) : pc.red(label)}\n`,
  );
  return result.passed ? 0 : 1;
}
