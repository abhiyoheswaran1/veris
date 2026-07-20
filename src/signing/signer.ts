import type { DsseSignature } from "../evidence/dsse.js";

export interface KeylessIdentity {
  issuer: string;
  subject: string;
}

export type SignerRef = string | KeylessIdentity;

export interface SignerTrust {
  signers: SignerRef[];
  pubKeyId?: string;
}

export interface Signer {
  backend: DsseSignature["backend"];
  sign(pae: Buffer): Promise<DsseSignature>;
}

export interface Verifier {
  verify(
    pae: Buffer,
    sig: DsseSignature,
    trust: SignerTrust,
  ): Promise<{
    ok: boolean;
    identity?: KeylessIdentity;
    reason: string;
    keyid?: string;
  }>;
}
