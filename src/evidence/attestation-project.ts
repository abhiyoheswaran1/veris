import { readFileSync } from "node:fs";
import type { VerdictState } from "../core/model.js";
import { anchorIgnoringAttestations } from "../git/changes.js";
import {
  type Attestation,
  buildAttestation,
  signAttestation,
} from "./attestation.js";
import { signatureKeyId } from "./signing.js";
import { readLatestRecord, writeAttestation } from "./store.js";

export interface AttestOutcome {
  ok: boolean;
  error?: string;
  path?: string;
  subjectCommit?: string;
  verdict?: VerdictState;
  signerKeyId?: string;
  attestation?: Attestation;
}

// Programmatic attestation: read the latest evidence, guard against a
// missing run / non-git project / dirty tree / stale evidence, sign (if a
// key is available), and write the attestation. Never prints, never exits —
// callers (CLI, MCP server) decide how to surface the result.
export async function attestProject(
  root: string,
  opts: { key?: string; out?: string } = {},
): Promise<AttestOutcome> {
  const record = await readLatestRecord(root);
  if (!record) {
    return {
      ok: false,
      error: "no verification run found — run `veris verify` first.",
    };
  }
  if (!record.git) {
    return { ok: false, error: "cannot attest outside a git repository." };
  }
  if (record.git.dirty) {
    return {
      ok: false,
      error: "cannot attest a dirty tree — commit or stash first.",
    };
  }
  const anchor = await anchorIgnoringAttestations(root);
  if (!anchor) {
    return { ok: false, error: "cannot attest outside a git repository." };
  }
  if (anchor.dirty) {
    return {
      ok: false,
      error: "cannot attest a dirty tree — commit or stash first.",
    };
  }
  if (record.git.commit !== anchor.commit) {
    return {
      ok: false,
      error: `evidence is for ${record.git.commit.slice(0, 7)} but HEAD is ${anchor.commit.slice(0, 7)} — re-run \`veris verify\`.`,
    };
  }

  let privateKeyPem: string | undefined;
  if (process.env.VERISKIT_SIGNING_KEY) {
    privateKeyPem = process.env.VERISKIT_SIGNING_KEY;
  } else if (opts.key) {
    try {
      privateKeyPem = readFileSync(opts.key, "utf8");
    } catch {
      return { ok: false, error: `cannot read signing key at ${opts.key}` };
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

  return {
    ok: true,
    path: ref,
    subjectCommit: record.git.commit,
    verdict: record.verdict.state,
    signerKeyId: att.signature ? signatureKeyId(att.signature) : undefined,
    attestation: att,
  };
}
