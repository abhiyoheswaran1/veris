import type { Attestation } from "../evidence/attestation.js";
import { latestAttestation } from "../evidence/store.js";
import { anchorIgnoringAttestations } from "../git/changes.js";
import { readJsonIfExists } from "../util/fs-safe.js";
import {
  evaluatePolicy,
  type GateResult,
  loadPolicy,
  loadPolicyFile,
  type Policy,
} from "./policy.js";

export interface GateOutcome {
  ok: boolean;
  error?: string;
  result?: GateResult;
  attestationPath?: string;
}

// Programmatic gate check: load policy (fail-closed on malformed), load the
// attestation (latest, or an explicit path), anchor against the current git
// state, and evaluate. Never prints, never exits — callers (CLI, MCP server)
// decide how to surface the result.
export async function gateProject(
  root: string,
  opts: { policy?: string; attestation?: string; pubKeyId?: string } = {},
): Promise<GateOutcome> {
  let policy: Policy;
  try {
    policy = opts.policy
      ? await loadPolicyFile(opts.policy)
      : await loadPolicy(root);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let att: Attestation;
  let attestationPath: string | undefined;
  if (opts.attestation) {
    const loaded = await readJsonIfExists<Attestation>(opts.attestation);
    if (!loaded) {
      return {
        ok: false,
        error: `cannot read attestation at ${opts.attestation}`,
      };
    }
    att = loaded;
    attestationPath = opts.attestation;
  } else {
    const found = latestAttestation(root);
    if (!found) {
      return {
        ok: false,
        error: "no attestation found — run `veris attest`.",
      };
    }
    att = found.att;
    attestationPath = found.path;
  }

  const git = await anchorIgnoringAttestations(root);
  let result: GateResult;
  try {
    result = evaluatePolicy(att, policy, git, { pubKeyId: opts.pubKeyId });
  } catch {
    return { ok: false, error: "malformed attestation" };
  }

  return { ok: true, result, attestationPath };
}
