import { ed25519Signer } from "../signing/ed25519.js";
import {
  ATTESTATION_SCHEMA_V2,
  type AttestationV2,
  buildEnvelope,
  envelopePae,
} from "./dsse.js";
import { canonicalize, type EvidenceRecord, sha256 } from "./record.js";
import { type Signature, signDigest, verifySignature } from "./signing.js";

export const ATTESTATION_SCHEMA = "veriskit/attestation@1";
export const STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
export const PREDICATE_TYPE =
  "https://veriskit.dev/attestations/verification/v1";

export interface Statement {
  _type: string;
  subject: Array<{ name: string; digest: { gitCommit: string } }>;
  predicateType: string;
  predicate: EvidenceRecord;
}

export interface Attestation {
  schema: string;
  statement: Statement;
  signature: Signature | null;
}

// The value that is signed and re-checked on verify: sha256 over the canonical
// statement (same canonicalization the evidence digest uses).
export function attestationDigest(statement: Statement): string {
  return sha256(canonicalize(statement));
}

// Build an unsigned attestation from an evidence record. Throws if the record
// has no git anchor — an attestation must name a commit.
export function buildAttestation(record: EvidenceRecord): Attestation {
  if (!record.git) {
    throw new Error("cannot attest: evidence has no git anchor");
  }
  const statement: Statement = {
    _type: STATEMENT_TYPE,
    subject: [
      { name: record.project.name, digest: { gitCommit: record.git.commit } },
    ],
    predicateType: PREDICATE_TYPE,
    predicate: record,
  };
  return { schema: ATTESTATION_SCHEMA, statement, signature: null };
}

export function signAttestation(
  att: Attestation,
  privateKeyPem: string,
): Attestation {
  return {
    ...att,
    signature: signDigest(attestationDigest(att.statement), privateKeyPem),
  };
}

// True only when a signature is present, was made over THIS statement's digest,
// and verifies.
export function verifyAttestationSignature(att: Attestation): boolean {
  if (!att.signature) return false;
  if (att.signature.digest !== attestationDigest(att.statement)) return false;
  return verifySignature(att.signature);
}

// Build an unsigned @2 (DSSE) attestation from an evidence record. Same
// Statement as buildAttestation, wrapped in a DSSE envelope instead of the
// legacy schema@1 shape. Throws if the record has no git anchor.
export function buildAttestationV2(record: EvidenceRecord): AttestationV2 {
  if (!record.git) {
    throw new Error("cannot attest: evidence has no git anchor");
  }
  const statement: Statement = {
    _type: STATEMENT_TYPE,
    subject: [
      { name: record.project.name, digest: { gitCommit: record.git.commit } },
    ],
    predicateType: PREDICATE_TYPE,
    predicate: record,
  };
  return { schema: ATTESTATION_SCHEMA_V2, envelope: buildEnvelope(statement) };
}

// Sign a @2 attestation's envelope PAE with the ed25519 backend, returning a
// new AttestationV2 whose envelope carries the appended signature (does not
// mutate the input).
export async function signAttestationV2(
  att: AttestationV2,
  privateKeyPem: string,
): Promise<AttestationV2> {
  const sig = await ed25519Signer(privateKeyPem).sign(
    envelopePae(att.envelope),
  );
  return {
    ...att,
    envelope: {
      ...att.envelope,
      signatures: [...att.envelope.signatures, sig],
    },
  };
}

// Read the Statement out of either a legacy @1 attestation or a @2 DSSE
// attestation, so gate logic can accept both formats.
//
// SECURITY: this dispatches on `att.schema` EXACTLY, with no heuristic
// fallback. An earlier version also treated "has an `envelope` property" as
// a signal to read the @2 path — that let an attacker take a validly-signed
// @1 attestation (whose signature covers `att.statement`), bolt on an
// `envelope` field carrying a *different*, malicious payload, and have the
// gate's signature check run over `att.statement` while its predicate read
// came from `envelope.payload`. Signature and statement must always come
// from the same schema-selected path.
export function attestationStatement(
  att: Attestation | AttestationV2,
): Statement {
  if (att.schema === ATTESTATION_SCHEMA_V2) {
    const env = (att as AttestationV2).envelope;
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(env.payload, "base64").toString("utf8"));
    } catch {
      throw new Error("malformed attestation envelope");
    }
    if (
      !decoded ||
      typeof decoded !== "object" ||
      !("predicate" in decoded) ||
      !("subject" in decoded) ||
      !Array.isArray((decoded as { subject?: unknown }).subject)
    ) {
      throw new Error("malformed attestation statement");
    }
    return decoded as Statement;
  }
  if (att.schema === ATTESTATION_SCHEMA) {
    return (att as Attestation).statement;
  }
  throw new Error("unknown attestation schema");
}
