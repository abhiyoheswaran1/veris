import { describe, expect, it } from "vitest";
import type { VerificationRun } from "../core/model.js";
import { buildBundle, verifyBundle } from "./bundle.js";
import { buildRecord } from "./record.js";

function rec() {
  const run = {
    id: "r1",
    startedAt: "t",
    project: {
      root: "/x",
      name: "n",
      packageManager: "npm",
      frameworks: [],
      languages: [],
      scripts: {},
      capabilities: [],
    },
    results: [],
    verdict: {
      state: "verified",
      verifiedCapabilities: [],
      skipped: [],
      reasons: [],
    },
    env: { os: "x", node: "v24", pm: "npm", ci: false, timestamp: "t" },
  } as unknown as VerificationRun;
  return buildRecord(run, null, {}, "0.4.0");
}

describe("bundle", () => {
  it("builds and verifies a self-consistent bundle", () => {
    const bundle = buildBundle(rec(), "# report", { unit: "log body" });
    const result = verifyBundle(bundle);
    expect(result.ok).toBe(true);
    expect(result.kind).toBe("bundle");
  });

  it("fails when an embedded log is tampered", () => {
    const bundle = buildBundle(rec(), "# report", { unit: "log body" });
    bundle.logs.unit = "tampered";
    const result = verifyBundle(bundle);
    expect(result.ok).toBe(false);
    expect(result.checks.find((c) => c.name === "log:unit")?.ok).toBe(false);
  });

  it("fails when the report is tampered", () => {
    const bundle = buildBundle(rec(), "# report", {});
    bundle.report = "# forged";
    expect(verifyBundle(bundle).ok).toBe(false);
  });
});

import { generateKeyPair, signDigest } from "./signing.js";

describe("bundle signatures", () => {
  it("verifies a bundle that carries a valid signature", () => {
    const r = rec();
    const kp = generateKeyPair();
    const sig = signDigest(r.digest, kp.privateKeyPem);
    const bundle = buildBundle(r, "# report", { unit: "log" }, sig);
    const result = verifyBundle(bundle);
    expect(result.signed).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("fails when the carried signature is tampered", () => {
    const r = rec();
    const kp = generateKeyPair();
    const sig = signDigest(r.digest, kp.privateKeyPem);
    const bundle = buildBundle(r, "# report", {}, sig);
    bundle.signature = {
      ...sig,
      signature: Buffer.from("x").toString("base64"),
    };
    expect(verifyBundle(bundle).ok).toBe(false);
  });

  it("stays unsigned when no signature is provided", () => {
    const bundle = buildBundle(rec(), "# report", {});
    expect(verifyBundle(bundle).signed).toBe(false);
  });
});
