import { readFileSync } from "node:fs";
import pc from "picocolors";
import type { Attestation } from "../../evidence/attestation.js";
import { keyId } from "../../evidence/signing.js";
import { latestAttestation } from "../../evidence/store.js";
import { changedFiles, type GitAnchor, gitAnchor } from "../../git/changes.js";
import {
  evaluatePolicy,
  loadPolicy,
  type Policy,
} from "../../policy/policy.js";
import { readJsonIfExists } from "../../util/fs-safe.js";
import { isPlain } from "../tty.js";

// gitAnchor's `dirty` reflects the whole working tree, including veriskit's own
// `.veris/` output. `.veris/attestations` is deliberately not gitignored
// (attestations are meant to be shareable/committable proof), so a freshly
// written attestation is itself untracked immediately after `attest` — which
// would make a gate run right after an attest spuriously see a "dirty" tree.
// Freshness should track the tracked SOURCE tree, so ONLY changes confined to
// `.veris/attestations/` are exempt. Everything else under `.veris/` —
// notably `policy.json` and `config.json`, which are tracked and read live
// off disk by `loadPolicy` — must still trip the dirty check. Exempting all
// of `.veris/` would let an uncommitted, unreviewed edit to policy.json
// (e.g. dropping `require.signers` or setting `freshness: "off"`) sneak past
// gate under a falsely "clean" tree.
async function currentAnchor(root: string): Promise<GitAnchor | null> {
  const anchor = await gitAnchor(root);
  if (!anchor?.dirty) return anchor;
  const cs = await changedFiles(root);
  const meaningful = cs.files.filter(
    (f) => !f.startsWith(".veris/attestations/"),
  );
  if (meaningful.length > 0) return anchor;
  return { ...anchor, dirty: false, changedFiles: 0 };
}

export async function runGate(
  root: string,
  opts: {
    policy?: string;
    attestation?: string;
    pubkey?: string;
    keyId?: string;
  } = {},
): Promise<number> {
  const policy: Policy = opts.policy
    ? ((await readJsonIfExists<Policy>(opts.policy)) ?? {})
    : await loadPolicy(root);

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

  const git = await currentAnchor(root);
  const result = evaluatePolicy(att, policy, git, { pubKeyId });

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
