import { readFileSync } from "node:fs";
import pc from "picocolors";
import { keyId } from "../../evidence/signing.js";
import { gateProject } from "../../policy/gate-project.js";
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

  const outcome = await gateProject(root, {
    policy: opts.policy,
    attestation: opts.attestation,
    pubKeyId,
  });

  if (!outcome.ok || !outcome.result) {
    process.stderr.write(`veris: ${outcome.error}\n`);
    return 1;
  }
  const result = outcome.result;

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
