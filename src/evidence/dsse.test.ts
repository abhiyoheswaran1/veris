import { describe, expect, it } from "vitest";
import type { Statement } from "./attestation.js";

import { buildEnvelope, DSSE_PAYLOAD_TYPE, envelopePae, pae } from "./dsse.js";

describe("pae", () => {
  it("matches the DSSE spec vector", () => {
    const got = pae(
      "http://example.com/HelloWorld",
      Buffer.from("hello world"),
    ).toString("utf8");
    expect(got).toBe("DSSEv1 29 http://example.com/HelloWorld 11 hello world");
  });
});

describe("buildEnvelope / envelopePae", () => {
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: "demo", digest: { gitCommit: "a".repeat(40) } }],
    predicateType: "https://veriskit.dev/attestations/verification/v1",
    predicate: {
      schema: "veriskit/evidence@1",
      verdict: { state: "verified" },
    },
  } as unknown as Statement;

  it("payload is base64 of the canonical statement; PAE wraps it", () => {
    const env = buildEnvelope(statement);
    expect(env.payloadType).toBe(DSSE_PAYLOAD_TYPE);
    expect(env.signatures).toEqual([]);
    const body = Buffer.from(env.payload, "base64");
    const p = envelopePae(env).toString("utf8");
    expect(
      p.startsWith(
        `DSSEv1 ${DSSE_PAYLOAD_TYPE.length} ${DSSE_PAYLOAD_TYPE} ${body.length} `,
      ),
    ).toBe(true);
  });
});
