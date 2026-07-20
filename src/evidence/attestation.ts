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
