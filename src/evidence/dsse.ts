import type { Statement } from "./attestation.js";

import { canonicalize } from "./record.js";

export const ATTESTATION_SCHEMA_V2 = "veriskit/attestation@2";
export const DSSE_PAYLOAD_TYPE = "application/vnd.in-toto+json";

export interface DsseSignature {
  backend: "ed25519" | "cosign";
  sig: string; // base64 signature over the PAE
  keyid?: string; // ed25519 key id
  publicKey?: string; // base64 SPKI DER (ed25519, self-contained verify)
  cert?: string; // base64 PEM (cosign/Fulcio keyless)
  tlogId?: string; // Rekor entry (keyless, informational)
}

export interface DsseEnvelope {
  payloadType: string;
  payload: string; // base64(canonicalize(statement))
  signatures: DsseSignature[];
}

export interface AttestationV2 {
  schema: string; // ATTESTATION_SCHEMA_V2
  envelope: DsseEnvelope;
}

// DSSE Pre-Authentication Encoding — the exact bytes a signature covers.
// PAE = "DSSEv1" SP LEN(type) SP type SP LEN(body) SP body
export function pae(payloadType: string, body: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `DSSEv1 ${Buffer.byteLength(payloadType)} ${payloadType} ${body.length} `,
      "utf8",
    ),
    body,
  ]);
}

export function statementBody(statement: Statement): Buffer {
  return Buffer.from(canonicalize(statement), "utf8");
}

export function buildEnvelope(statement: Statement): DsseEnvelope {
  const body = statementBody(statement);
  return {
    payloadType: DSSE_PAYLOAD_TYPE,
    payload: body.toString("base64"),
    signatures: [],
  };
}

export function envelopePae(env: DsseEnvelope): Buffer {
  return pae(env.payloadType, Buffer.from(env.payload, "base64"));
}
