import { describe, expect, it } from "vitest";
import {
  generateKeyPair,
  keyId,
  signatureKeyId,
  signDigest,
  verifySignature,
} from "./signing.js";

describe("signing", () => {
  it("round-trips: sign a digest then verify it", () => {
    const kp = generateKeyPair();
    const sig = signDigest("sha256:abc", kp.privateKeyPem);
    expect(sig.schema).toBe("veriskit/signature@1");
    expect(sig.alg).toBe("ed25519");
    expect(verifySignature(sig)).toBe(true);
  });

  it("keyId is stable and matches the embedded key", () => {
    const kp = generateKeyPair();
    const sig = signDigest("sha256:abc", kp.privateKeyPem);
    expect(sig.keyId).toBe(kp.keyId);
    expect(signatureKeyId(sig)).toBe(kp.keyId);
    expect(keyId(kp.publicKeyPem)).toBe(kp.keyId);
    expect(kp.keyId).toMatch(/^[0-9a-f]{8}$/);
  });

  it("fails when the signature bytes are tampered", () => {
    const kp = generateKeyPair();
    const sig = signDigest("sha256:abc", kp.privateKeyPem);
    const tampered = {
      ...sig,
      signature: Buffer.from("nope").toString("base64"),
    };
    expect(verifySignature(tampered)).toBe(false);
  });

  it("fails when the signed digest is changed", () => {
    const kp = generateKeyPair();
    const sig = signDigest("sha256:abc", kp.privateKeyPem);
    expect(verifySignature({ ...sig, digest: "sha256:def" })).toBe(false);
  });
});
