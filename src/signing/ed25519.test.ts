import { describe, expect, it } from "vitest";
import type { Statement } from "../evidence/attestation.js";
import { buildEnvelope, envelopePae } from "../evidence/dsse.js";
import { generateKeyPair } from "../evidence/signing.js";
import { ed25519Signer, ed25519Verifier } from "./ed25519.js";

const statement = {
  _type: "s",
  subject: [{ name: "d", digest: { gitCommit: "a".repeat(40) } }],
  predicateType: "p",
  predicate: {},
} as unknown as Statement;

describe("ed25519 backend", () => {
  it("signs and verifies the PAE", async () => {
    const kp = generateKeyPair();
    const env = buildEnvelope(statement);
    const sig = await ed25519Signer(kp.privateKeyPem).sign(envelopePae(env));
    expect(sig.backend).toBe("ed25519");
    const r = await ed25519Verifier.verify(envelopePae(env), sig, {
      signers: [sig.keyid!],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a signature over different bytes", async () => {
    const kp = generateKeyPair();
    const sig = await ed25519Signer(kp.privateKeyPem).sign(Buffer.from("A"));
    const r = await ed25519Verifier.verify(Buffer.from("B"), sig, {
      signers: ["*"],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an untrusted key id", async () => {
    const kp = generateKeyPair();
    const env = buildEnvelope(statement);
    const sig = await ed25519Signer(kp.privateKeyPem).sign(envelopePae(env));
    const r = await ed25519Verifier.verify(envelopePae(env), sig, {
      signers: ["deadbeef"],
    });
    expect(r.ok).toBe(false);
  });
});
