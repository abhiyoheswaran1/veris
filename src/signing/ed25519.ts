import {
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import type { DsseSignature } from "../evidence/dsse.js";
import { keyId } from "../evidence/signing.js";
import type { Signer, SignerTrust, Verifier } from "./signer.js";

function spkiDer(pub: KeyObject): Buffer {
  return pub.export({ type: "spki", format: "der" }) as Buffer;
}

export function ed25519Signer(privateKeyPem: string): Signer {
  return {
    backend: "ed25519",
    async sign(pae: Buffer): Promise<DsseSignature> {
      const priv = createPrivateKey(privateKeyPem);
      const pub = createPublicKey(
        priv as unknown as Parameters<typeof createPublicKey>[0],
      );
      return {
        backend: "ed25519",
        sig: cryptoSign(null, pae, priv).toString("base64"),
        keyid: keyId(pub),
        publicKey: spkiDer(pub).toString("base64"),
      };
    },
  };
}

export const ed25519Verifier: Verifier = {
  async verify(pae, sig, trust: SignerTrust) {
    if (sig.backend !== "ed25519" || !sig.publicKey) {
      return { ok: false, reason: "not an ed25519 signature" };
    }
    try {
      const pub = createPublicKey({
        key: Buffer.from(sig.publicKey, "base64"),
        format: "der",
        type: "spki",
      });
      const cryptoOk = cryptoVerify(
        null,
        pae,
        pub,
        Buffer.from(sig.sig, "base64"),
      );
      if (!cryptoOk) return { ok: false, reason: "signature does not verify" };
      const kid = keyId(pub);
      // Empty `signers` means "no signer-allowlist constraint" — matches the
      // @1 semantics where an absent/empty allowlist defers entirely to
      // trust.pubKeyId (or, with neither set, accepts any valid signature).
      // A non-empty allowlist is still enforced exactly as before.
      const allowed =
        trust.signers.length === 0 ||
        trust.signers.some((s) => s === "*" || s === kid);
      const trustOk = !trust.pubKeyId || trust.pubKeyId === kid;
      const ok = allowed && trustOk;
      return {
        ok,
        keyid: kid,
        reason: ok ? `signed by ${kid}` : `signer ${kid} not accepted`,
      };
    } catch {
      return { ok: false, reason: "invalid public key" };
    }
  },
};
