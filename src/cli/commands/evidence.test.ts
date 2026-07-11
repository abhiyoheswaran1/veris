import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { VerificationRun } from "../../core/model.js";
import { buildRecord } from "../../evidence/record.js";
import { createRunDir, writeEvidence } from "../../evidence/store.js";
import {
  runEvidenceKeygen,
  runEvidenceSign,
  runEvidenceVerify,
} from "./evidence.js";

function record() {
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

describe("runEvidenceVerify", () => {
  it("returns 0 for an untouched evidence.json", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-ev-"));
    const dir = await createRunDir(root, "r1");
    const ref = await writeEvidence(dir, record());
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await runEvidenceVerify(ref)).toBe(0);
    vi.restoreAllMocks();
  });

  it("returns 1 for a missing file", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(await runEvidenceVerify("/no/such/evidence.json")).toBe(1);
    vi.restoreAllMocks();
  });
});

describe("runEvidenceKeygen + runEvidenceSign + signed verify", () => {
  it("keygen writes a keypair, sign writes a .sig, verify accepts it", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-sign-"));
    const dir = await createRunDir(root, "r1");
    const ref = await writeEvidence(dir, record());

    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const keyPath = join(root, "k.key");
    expect(await runEvidenceKeygen(root, { out: keyPath })).toBe(0);
    expect(readFileSync(`${keyPath}.pub`, "utf8")).toContain("PUBLIC KEY");

    expect(await runEvidenceSign(ref, { key: keyPath })).toBe(0);
    expect(readFileSync(`${ref}.sig`, "utf8")).toContain(
      "veriskit/signature@1",
    );

    expect(await runEvidenceVerify(ref)).toBe(0);
    vi.restoreAllMocks();
  });

  it("keygen refuses to overwrite an existing key", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-sign2-"));
    const keyPath = join(root, "k.key");
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(await runEvidenceKeygen(root, { out: keyPath })).toBe(0);
    expect(await runEvidenceKeygen(root, { out: keyPath })).toBe(1);
    vi.restoreAllMocks();
  });
});

describe("runEvidenceSign security guards", () => {
  it("refuses to sign when no key is provided", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-nokey-"));
    const dir = await createRunDir(root, "r1");
    const ref = await writeEvidence(dir, record());
    const prev = process.env.VERISKIT_SIGNING_KEY;
    delete process.env.VERISKIT_SIGNING_KEY;
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(await runEvidenceSign(ref, {})).toBe(1);
    if (prev !== undefined) process.env.VERISKIT_SIGNING_KEY = prev;
    vi.restoreAllMocks();
  });

  it("refuses to sign a record whose digest does not match its contents", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-broken-"));
    const dir = await createRunDir(root, "r1");
    const ref = await writeEvidence(dir, record());
    const rec = JSON.parse(readFileSync(ref, "utf8"));
    rec.verdict.state = "failed"; // tamper the body, leaving a stale digest
    writeFileSync(ref, JSON.stringify(rec, null, 2));
    const keyPath = join(root, "k.key");
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await runEvidenceKeygen(root, { out: keyPath });
    expect(await runEvidenceSign(ref, { key: keyPath })).toBe(1);
    vi.restoreAllMocks();
  });
});
