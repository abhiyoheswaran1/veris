import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

export const SIGNATURE_SCHEMA = "veriskit/signature@1";

export interface Signature {
  schema: string;
  alg: string; // "ed25519"
  keyId: string; // sha256(public key DER), first 8 hex chars
  publicKey: string; // base64 SPKI DER
  digest: string; // the record digest that was signed
  signature: string; // base64 ed25519 signature over the UTF-8 bytes of `digest`
  signedAt: string;
}

function derOf(publicKey: KeyObject): Buffer {
  return publicKey.export({ type: "spki", format: "der" }) as Buffer;
}

export function keyId(publicKey: KeyObject | string): string {
  const key =
    typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
  return createHash("sha256").update(derOf(key)).digest("hex").slice(0, 8);
}

export function signatureKeyId(sig: Signature): string {
  const key = createPublicKey({
    key: Buffer.from(sig.publicKey, "base64"),
    format: "der",
    type: "spki",
  });
  return keyId(key);
}

export function generateKeyPair(): {
  publicKeyPem: string;
  privateKeyPem: string;
  keyId: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKeyPem: privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string,
    keyId: keyId(publicKey),
  };
}

export function signDigest(digest: string, privateKeyPem: string): Signature {
  const privateKey = createPrivateKey(privateKeyPem);
  // node:crypto's createPublicKey accepts a private KeyObject at runtime
  // (deriving the public key), but @types/node's overloads don't model
  // this case, so the argument type is asserted here.
  const publicKey = createPublicKey(
    privateKey as unknown as Parameters<typeof createPublicKey>[0],
  );
  const sig = cryptoSign(null, Buffer.from(digest, "utf8"), privateKey);
  return {
    schema: SIGNATURE_SCHEMA,
    alg: "ed25519",
    keyId: keyId(publicKey),
    publicKey: derOf(publicKey).toString("base64"),
    digest,
    signature: sig.toString("base64"),
    signedAt: new Date().toISOString(),
  };
}

export function verifySignature(sig: Signature): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(sig.publicKey, "base64"),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(
      null,
      Buffer.from(sig.digest, "utf8"),
      publicKey,
      Buffer.from(sig.signature, "base64"),
    );
  } catch {
    return false;
  }
}
