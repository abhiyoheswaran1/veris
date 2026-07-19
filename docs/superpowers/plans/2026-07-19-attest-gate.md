# Veris `attest` + `gate` — v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `veris attest` (package + sign the latest verification as a portable in-toto attestation) and `veris gate` (block unless a valid attestation proves *this exact commit* was verified to a policy) — reusing the existing evidence + Ed25519 signing, with zero new runtime dependencies.

**Architecture:** An attestation is an in-toto `Statement` whose `predicate` is the existing `EvidenceRecord`, signed with the existing `signDigest` over `sha256(canonicalize(statement))`. `veris attest` reads the latest `evidence.json`, guards against non-repo/dirty trees, signs, and writes `.veris/attestations/<id>.att.json`. `veris gate` loads `.veris/policy.json`, the latest attestation, and the current git state, then runs five honesty-ordered checks (integrity → signature/signer → freshness → verdict → required capabilities×languages) and exits 0/1. All new code is JSON + Node built-in crypto.

**Tech Stack:** TypeScript (strict, ESM, `.js` specifiers), Vitest, Biome, cac. No new dependencies. No version bump (`package.json` stays `0.6.1`).

## Global Constraints

- **No new runtime dependencies; no version bump.**
- **ESM import specifiers end in `.js`; `veriskit`/`VerisKit` naming; TypeScript strict.**
- **Reuse, don't reinvent:** `canonicalize`/`sha256`/`computeDigest`/`EvidenceRecord` (`evidence/record.ts`); `Signature`/`signDigest`/`verifySignature`/`signatureKeyId`/`keyId` (`evidence/signing.ts`); `gitAnchor`/`GitAnchor` (`git/changes.ts`); `latestRunDir`/`ensureDir`/`readJsonIfExists`.
- **Command shape:** each command module exports `runX(root, opts): Promise<number>` returning the exit code; register in `src/cli/index.ts` lazy-imported, resolving `root` and exiting exactly like the existing `verify`/`evidence` commands. Errors go to `process.stderr` prefixed `veris: `.
- **Signing key resolution (match `runEvidenceSign`):** `VERISKIT_SIGNING_KEY` env first, else `--key <pem-path>` via `readFileSync`; absent ⇒ unsigned.
- **Attestations are shareable proof — do NOT gitignore `.veris/attestations/`.**
- **Every task ends green:** `npm run verify` passes before each commit.
- **TDD, DRY, YAGNI, frequent commits.**

## Global Constants (used verbatim across tasks)

- `ATTESTATION_SCHEMA = "veriskit/attestation@1"`
- `STATEMENT_TYPE = "https://in-toto.io/Statement/v1"`
- `PREDICATE_TYPE = "https://veriskit.dev/attestations/verification/v1"`

---

## File Structure

- `src/evidence/attestation.ts` — NEW: types + `buildAttestation`/`attestationDigest`/`signAttestation`/`verifyAttestationSignature`.
- `src/evidence/store.ts` — add `attestationsDir`/`writeAttestation`/`latestAttestation`/`readLatestRecord`.
- `src/cli/commands/attest.ts` — NEW: `runAttest`.
- `src/policy/policy.ts` — NEW: `Policy`/`DEFAULT_POLICY`/`loadPolicy`/`evaluatePolicy`.
- `src/cli/commands/gate.ts` — NEW: `runGate`.
- `src/cli/index.ts` — register `attest` + `gate`.
- `src/cli/commands/init.ts` — write starter `.veris/policy.json`.
- `README.md`, `CHANGELOG.md` — docs (Unreleased).
- Test files alongside each.

---

## Task 1: Attestation format + signing

**Files:**
- Create: `src/evidence/attestation.ts`
- Test: `src/evidence/attestation.test.ts`

**Interfaces:**
- Consumes: `canonicalize`, `computeDigest`, `sha256`, `EvidenceRecord` (`./record.js`); `Signature`, `signDigest`, `verifySignature` (`./signing.js`).
- Produces:
  - `Statement`, `Attestation` interfaces + the three schema/type constants.
  - `buildAttestation(record: EvidenceRecord): Attestation` (throws if `record.git` is null).
  - `attestationDigest(statement: Statement): string`.
  - `signAttestation(att: Attestation, privateKeyPem: string): Attestation`.
  - `verifyAttestationSignature(att: Attestation): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/evidence/attestation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "./record.js";
import { generateKeyPair } from "./signing.js";
import {
  ATTESTATION_SCHEMA,
  buildAttestation,
  PREDICATE_TYPE,
  signAttestation,
  STATEMENT_TYPE,
  verifyAttestationSignature,
} from "./attestation.js";

function record(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  const base: EvidenceRecord = {
    schema: "veriskit/evidence@1",
    id: "run-1",
    startedAt: "2026-07-19T00:00:00.000Z",
    tool: { name: "veriskit", version: "0.6.1" },
    git: { commit: "a".repeat(40), branch: "main", dirty: false, changedFiles: 0 },
    env: { os: "linux", node: "v24", pm: "npm", ci: false, timestamp: "t" },
    project: { name: "demo", packageManager: "npm", frameworks: [], languages: ["js"] },
    scope: { kind: "full", changedCount: 0 },
    checks: [],
    verdict: { state: "verified", verifiedCapabilities: ["unit:js"], skipped: [], reasons: [] },
    digest: "sha256:placeholder",
  };
  return { ...base, ...overrides };
}

describe("buildAttestation", () => {
  it("wraps the record as an in-toto statement subject-ed to the git commit", () => {
    const att = buildAttestation(record());
    expect(att.schema).toBe(ATTESTATION_SCHEMA);
    expect(att.statement._type).toBe(STATEMENT_TYPE);
    expect(att.statement.predicateType).toBe(PREDICATE_TYPE);
    expect(att.statement.subject[0]).toEqual({
      name: "demo",
      digest: { gitCommit: "a".repeat(40) },
    });
    expect(att.statement.predicate.verdict.state).toBe("verified");
    expect(att.signature).toBeNull();
  });

  it("throws when the record has no git anchor", () => {
    expect(() => buildAttestation(record({ git: null }))).toThrow(/git/);
  });
});

describe("signAttestation / verifyAttestationSignature", () => {
  it("round-trips a signature", () => {
    const kp = generateKeyPair();
    const signed = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    expect(signed.signature).not.toBeNull();
    expect(verifyAttestationSignature(signed)).toBe(true);
  });

  it("rejects a signature after the statement is tampered", () => {
    const kp = generateKeyPair();
    const signed = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    signed.statement.predicate.verdict.state = "failed"; // tamper
    expect(verifyAttestationSignature(signed)).toBe(false);
  });

  it("is false for an unsigned attestation", () => {
    expect(verifyAttestationSignature(buildAttestation(record()))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/evidence/attestation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/evidence/attestation.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/evidence/attestation.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/evidence/attestation.ts src/evidence/attestation.test.ts
git commit -m "feat(evidence): in-toto attestation format + Ed25519 sign/verify"
```

---

## Task 2: Attestation + record store helpers

**Files:**
- Modify: `src/evidence/store.ts`
- Test: `src/evidence/store.test.ts` (extend)

**Interfaces:**
- Consumes: `Attestation` (`./attestation.js`); `EvidenceRecord` (`./record.js`); `readJsonIfExists` (`../util/fs-safe.js`).
- Produces:
  - `attestationsDir(root: string): string` → `<root>/.veris/attestations`.
  - `writeAttestation(root: string, id: string, att: Attestation): Promise<string>` → writes `<id>.att.json`, returns path.
  - `latestAttestation(root: string): { path: string; att: Attestation } | null`.
  - `readLatestRecord(root: string): Promise<EvidenceRecord | null>` → reads the latest run's `evidence.json`.

- [ ] **Step 1: Write the failing test**

Add to `src/evidence/store.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attestationsDir,
  latestAttestation,
  writeAttestation,
} from "./store.js";
import type { Attestation } from "./attestation.js";

describe("attestation store", () => {
  const att = (commit: string): Attestation => ({
    schema: "veriskit/attestation@1",
    statement: {
      _type: "https://in-toto.io/Statement/v1",
      subject: [{ name: "demo", digest: { gitCommit: commit } }],
      predicateType: "https://veriskit.dev/attestations/verification/v1",
      // biome-ignore lint/suspicious/noExplicitAny: minimal predicate for the store round-trip
      predicate: { id: "r1" } as any,
    },
    signature: null,
  });

  it("writes and reads back the latest attestation", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-att-"));
    await writeAttestation(root, "run-1", att("a".repeat(40)));
    const found = latestAttestation(root);
    expect(found?.att.statement.subject[0]?.digest.gitCommit).toBe("a".repeat(40));
    expect(found?.path.startsWith(attestationsDir(root))).toBe(true);
  });

  it("returns null when there are no attestations", () => {
    const root = mkdtempSync(join(tmpdir(), "veris-att-none-"));
    expect(latestAttestation(root)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/evidence/store.test.ts`
Expected: FAIL — the new exports don't exist.

- [ ] **Step 3: Add the helpers to `src/evidence/store.ts`**

Add these imports at the top (merge with existing ones; `readFileSync`/`readdirSync` from `node:fs`, `writeFile`/`readFile` from `node:fs/promises`, `join` from `node:path` are already imported — add `readJsonIfExists` and the two type imports):

```ts
import type { Attestation } from "./attestation.js";
import type { EvidenceRecord } from "./record.js";
import { ensureDir, readJsonIfExists } from "../util/fs-safe.js";
```

(If `ensureDir` is already imported from `../util/fs-safe.js`, just add `readJsonIfExists` to that import.)

Append the helpers:

```ts
export function attestationsDir(root: string): string {
  return join(root, ".veris", "attestations");
}

export async function writeAttestation(
  root: string,
  id: string,
  att: Attestation,
): Promise<string> {
  const dir = attestationsDir(root);
  await ensureDir(dir);
  const ref = join(dir, `${id}.att.json`);
  await writeFile(ref, `${JSON.stringify(att, null, 2)}\n`, "utf8");
  return ref;
}

export function latestAttestation(
  root: string,
): { path: string; att: Attestation } | null {
  try {
    const files = readdirSync(attestationsDir(root))
      .filter((f) => f.endsWith(".att.json"))
      .sort();
    const latest = files.at(-1);
    if (!latest) return null;
    const path = join(attestationsDir(root), latest);
    return { path, att: JSON.parse(readFileSync(path, "utf8")) as Attestation };
  } catch {
    return null;
  }
}

export async function readLatestRecord(
  root: string,
): Promise<EvidenceRecord | null> {
  const dir = latestRunDir(root);
  if (!dir) return null;
  return readJsonIfExists<EvidenceRecord>(join(dir, "evidence.json"));
}
```

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/evidence/store.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/evidence/store.ts src/evidence/store.test.ts
git commit -m "feat(evidence): attestation + latest-record store helpers"
```

---

## Task 3: `veris attest` command

**Files:**
- Create: `src/cli/commands/attest.ts`
- Modify: `src/cli/index.ts`
- Test: `src/cli/commands/attest.test.ts`

**Interfaces:**
- Consumes: `readLatestRecord`, `writeAttestation` (`../../evidence/store.js`); `buildAttestation`, `signAttestation` (`../../evidence/attestation.js`); `signatureKeyId` (`../../evidence/signing.js`).
- Produces: `runAttest(root: string, opts?: { key?: string; out?: string }): Promise<number>`.

- [ ] **Step 1: Write the failing test**

Create `src/cli/commands/attest.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { latestAttestation } from "../../evidence/store.js";
import { runAttest } from "./attest.js";

function repoWithEvidence(dirty: boolean, commit = "a".repeat(40)): string {
  const root = mkdtempSync(join(tmpdir(), "veris-attest-"));
  const runDir = join(root, ".veris", "runs", "2026-01-01T00-00-00-1");
  mkdirSync(runDir, { recursive: true });
  const record = {
    schema: "veriskit/evidence@1",
    id: "2026-01-01T00-00-00-1",
    startedAt: "t",
    tool: { name: "veriskit", version: "0.6.1" },
    git: { commit, branch: "main", dirty, changedFiles: dirty ? 1 : 0 },
    env: { os: "linux", node: "v24", pm: "npm", ci: false, timestamp: "t" },
    project: { name: "demo", packageManager: "npm", frameworks: [], languages: ["js"] },
    scope: { kind: "full", changedCount: 0 },
    checks: [],
    verdict: { state: "verified", verifiedCapabilities: ["unit:js"], skipped: [], reasons: [] },
    digest: "sha256:x",
  };
  writeFileSync(join(runDir, "evidence.json"), JSON.stringify(record));
  return root;
}

describe("runAttest", () => {
  it("writes an unsigned attestation for a clean tree", async () => {
    const root = repoWithEvidence(false);
    const code = await runAttest(root);
    expect(code).toBe(0);
    const found = latestAttestation(root);
    expect(found?.att.statement.subject[0]?.digest.gitCommit).toBe("a".repeat(40));
    expect(found?.att.signature).toBeNull();
  });

  it("refuses a dirty tree", async () => {
    const root = repoWithEvidence(true);
    expect(await runAttest(root)).toBe(1);
    expect(latestAttestation(root)).toBeNull();
  });

  it("errors when there is no verification run", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-attest-empty-"));
    expect(await runAttest(root)).toBe(1);
  });

  it("signs when VERISKIT_SIGNING_KEY is set", async () => {
    const root = repoWithEvidence(false);
    const { generateKeyPair } = await import("../../evidence/signing.js");
    const kp = generateKeyPair();
    const prev = process.env.VERISKIT_SIGNING_KEY;
    process.env.VERISKIT_SIGNING_KEY = kp.privateKeyPem;
    try {
      expect(await runAttest(root)).toBe(0);
      expect(latestAttestation(root)?.att.signature).not.toBeNull();
    } finally {
      process.env.VERISKIT_SIGNING_KEY = prev;
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/cli/commands/attest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/cli/commands/attest.ts`**

```ts
import { readFileSync } from "node:fs";
import {
  buildAttestation,
  signAttestation,
} from "../../evidence/attestation.js";
import { signatureKeyId } from "../../evidence/signing.js";
import { readLatestRecord, writeAttestation } from "../../evidence/store.js";

export async function runAttest(
  root: string,
  opts: { key?: string; out?: string } = {},
): Promise<number> {
  const record = await readLatestRecord(root);
  if (!record) {
    process.stderr.write(
      "veris: no verification run found — run `veris verify` first.\n",
    );
    return 1;
  }
  if (!record.git) {
    process.stderr.write("veris: cannot attest outside a git repository.\n");
    return 1;
  }
  if (record.git.dirty) {
    process.stderr.write(
      "veris: cannot attest a dirty tree — commit or stash first.\n",
    );
    return 1;
  }

  let privateKeyPem: string | undefined;
  if (process.env.VERISKIT_SIGNING_KEY) {
    privateKeyPem = process.env.VERISKIT_SIGNING_KEY;
  } else if (opts.key) {
    try {
      privateKeyPem = readFileSync(opts.key, "utf8");
    } catch {
      process.stderr.write(`veris: cannot read signing key at ${opts.key}\n`);
      return 1;
    }
  }

  let att = buildAttestation(record);
  if (privateKeyPem) att = signAttestation(att, privateKeyPem);

  let ref: string;
  if (opts.out) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(opts.out, `${JSON.stringify(att, null, 2)}\n`, "utf8");
    ref = opts.out;
  } else {
    ref = await writeAttestation(root, record.id, att);
  }

  const signer = att.signature
    ? `signed by ${signatureKeyId(att.signature)}`
    : "unsigned (set VERISKIT_SIGNING_KEY or pass --key to sign)";
  process.stdout.write(
    [
      `Attestation ${ref}`,
      `Subject     ${record.git.commit.slice(0, 7)} · verdict ${record.verdict.state}`,
      `Signature   ${signer}`,
      "",
    ].join("\n"),
  );
  return 0;
}
```

- [ ] **Step 4: Register `attest` in `src/cli/index.ts`**

Match the existing lazy-import + `process.exit` pattern used by `verify`/`evidence` (resolve `root` the same way those commands do). Add:

```ts
  cli
    .command("attest", "Package + sign the latest verification as a portable attestation")
    .option("--key <path>", "Ed25519 private key PEM (else VERISKIT_SIGNING_KEY)")
    .option("--out <path>", "write the attestation to this path")
    .action(async (opts) => {
      const { runAttest } = await import("./commands/attest.js");
      process.exit(await runAttest(process.cwd(), opts));
    });
```

(If the sibling commands resolve root differently than `process.cwd()`, use their exact approach.)

- [ ] **Step 5: Run tests, then full suite + dogfood**

Run: `npx vitest run src/cli/commands/attest.test.ts && npm run verify`
Expected: PASS.

Dogfood (this repo is clean + has run `verify` earlier in the suite? if not, run it):

Run: `node bin/veris verify >/dev/null; node bin/veris attest`
Expected: prints an `Attestation .veris/attestations/<id>.att.json` line, the subject commit, and `unsigned …` (or signed if a key is set). Exit 0. If the working tree is dirty it should instead refuse with the dirty-tree message — that is correct behavior.

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/attest.ts src/cli/commands/attest.test.ts src/cli/index.ts
git commit -m "feat(cli): veris attest — sign the latest verification into an attestation"
```

---

## Task 4: Policy model + `evaluatePolicy`

**Files:**
- Create: `src/policy/policy.ts`
- Test: `src/policy/policy.test.ts`

**Interfaces:**
- Consumes: `readJsonIfExists` (`../util/fs-safe.js`); `computeDigest` (`../evidence/record.js`); `Attestation`, `attestationDigest`, `verifyAttestationSignature` (`../evidence/attestation.js`); `signatureKeyId` (`../evidence/signing.js`).
- Produces: `Policy`, `DEFAULT_POLICY`, `loadPolicy(root)`, `GateCheck`, `GateResult`, `evaluatePolicy(att, policy, git, trust?)`.

- [ ] **Step 1: Write the failing test**

Create `src/policy/policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildAttestation,
  signAttestation,
} from "../evidence/attestation.js";
import type { EvidenceRecord } from "../evidence/record.js";
import { computeDigest } from "../evidence/record.js";
import { generateKeyPair, signatureKeyId } from "../evidence/signing.js";
import { DEFAULT_POLICY, evaluatePolicy, type Policy } from "./policy.js";

const COMMIT = "a".repeat(40);

function record(over: Partial<EvidenceRecord["verdict"]> = {}, commit = COMMIT): EvidenceRecord {
  const base = {
    schema: "veriskit/evidence@1",
    id: "r1",
    startedAt: "t",
    tool: { name: "veriskit", version: "0.6.1" },
    git: { commit, branch: "main", dirty: false, changedFiles: 0 },
    env: { os: "linux", node: "v24", pm: "npm", ci: false, timestamp: "t" },
    project: { name: "demo", packageManager: "npm", frameworks: [], languages: ["js"] },
    scope: { kind: "full" as const, changedCount: 0 },
    checks: [],
    verdict: {
      state: "verified" as const,
      verifiedCapabilities: ["unit:js", "types:js"],
      skipped: [],
      reasons: [],
      ...over,
    },
  };
  return { ...base, digest: computeDigest(base) } as EvidenceRecord;
}

const git = { commit: COMMIT, dirty: false };

describe("evaluatePolicy", () => {
  it("passes a signed, fresh, verified attestation meeting coverage", () => {
    const kp = generateKeyPair();
    const att = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    const policy: Policy = {
      require: { verdict: "verified", capabilities: ["unit"], languages: ["js"], signers: [signatureKeyId(att.signature!)] },
      freshness: "head",
    };
    const r = evaluatePolicy(att, policy, git);
    expect(r.passed).toBe(true);
  });

  it("fails on a tampered predicate (integrity)", () => {
    const att = buildAttestation(record());
    att.statement.predicate.verdict.state = "failed"; // digest no longer matches
    const r = evaluatePolicy(att, att.statement.predicate.git ? DEFAULT_POLICY : DEFAULT_POLICY, git);
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.label === "integrity")?.ok).toBe(false);
  });

  it("fails a stale commit (freshness)", () => {
    const att = buildAttestation(record({}, "b".repeat(40)));
    const r = evaluatePolicy(att, DEFAULT_POLICY, git);
    expect(r.checks.find((c) => c.label === "freshness")?.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("fails a dirty tree (freshness)", () => {
    const att = buildAttestation(record());
    const r = evaluatePolicy(att, DEFAULT_POLICY, { commit: COMMIT, dirty: true });
    expect(r.checks.find((c) => c.label === "freshness")?.ok).toBe(false);
  });

  it("fails a partial verdict under require verified, passes under partial-ok", () => {
    const att = buildAttestation(record({ state: "partial" }));
    expect(evaluatePolicy(att, { require: { verdict: "verified" }, freshness: "off" }, git).passed).toBe(false);
    expect(evaluatePolicy(att, { require: { verdict: "partial-ok" }, freshness: "off" }, git).passed).toBe(true);
  });

  it("fails when a required capability×language is not verified", () => {
    const att = buildAttestation(record());
    const r = evaluatePolicy(att, { require: { capabilities: ["unit"], languages: ["python"] }, freshness: "off" }, git);
    expect(r.checks.find((c) => c.label === "coverage")?.ok).toBe(false);
    expect(r.checks.find((c) => c.label === "coverage")?.reason).toContain("unit:python");
  });

  it("requires a valid signature when signers is set; unsigned fails", () => {
    const att = buildAttestation(record()); // unsigned
    const r = evaluatePolicy(att, { require: { signers: ["*"] }, freshness: "off" }, git);
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
  });

  it("rejects an untrusted signer", () => {
    const kp = generateKeyPair();
    const att = signAttestation(buildAttestation(record()), kp.privateKeyPem);
    const r = evaluatePolicy(att, { require: { signers: ["deadbeef"] }, freshness: "off" }, git);
    expect(r.checks.find((c) => c.label === "signature")?.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/policy/policy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/policy/policy.ts`**

```ts
import { join } from "node:path";
import {
  type Attestation,
  attestationDigest,
  verifyAttestationSignature,
} from "../evidence/attestation.js";
import { computeDigest } from "../evidence/record.js";
import { signatureKeyId } from "../evidence/signing.js";
import { readJsonIfExists } from "../util/fs-safe.js";

export interface Policy {
  require?: {
    verdict?: "verified" | "partial-ok";
    capabilities?: string[];
    languages?: string[];
    signers?: string[];
  };
  freshness?: "head" | "off";
}

export const DEFAULT_POLICY: Policy = {
  require: { verdict: "verified" },
  freshness: "head",
};

export async function loadPolicy(root: string): Promise<Policy> {
  return (
    (await readJsonIfExists<Policy>(join(root, ".veris", "policy.json"))) ??
    DEFAULT_POLICY
  );
}

export interface GateCheck {
  label: string;
  ok: boolean;
  reason: string;
}
export interface GateResult {
  passed: boolean;
  checks: GateCheck[];
}

// Evaluate an attestation against a policy. `git` is the current repo state
// (null outside a repo). `trust.pubKeyId` is the key id derived from a CLI
// --pubkey / --key-id, which further constrains the accepted signer.
export function evaluatePolicy(
  att: Attestation,
  policy: Policy,
  git: { commit: string; dirty: boolean } | null,
  trust: { pubKeyId?: string } = {},
): GateResult {
  const req = policy.require ?? {};
  const checks: GateCheck[] = [];

  // 1. Integrity — predicate self-digest + signature-over-this-statement.
  const predicate = att.statement.predicate as unknown as Record<string, unknown> & { digest: string };
  const predOk = computeDigest(predicate) === att.statement.predicate.digest;
  const sigDigestOk =
    !att.signature || att.signature.digest === attestationDigest(att.statement);
  checks.push({
    label: "integrity",
    ok: predOk && sigDigestOk,
    reason: !predOk
      ? "predicate digest mismatch (tampered)"
      : sigDigestOk
        ? "record + statement digests intact"
        : "signature is over a different statement",
  });

  // 2. Signature / signer — only when required.
  const sigRequired = (req.signers?.length ?? 0) > 0 || Boolean(trust.pubKeyId);
  if (sigRequired) {
    if (!verifyAttestationSignature(att) || !att.signature) {
      checks.push({
        label: "signature",
        ok: false,
        reason: "policy requires a valid signature; none present or verification failed",
      });
    } else {
      const kid = signatureKeyId(att.signature);
      const signersOk =
        !req.signers?.length ||
        req.signers.includes("*") ||
        req.signers.includes(kid);
      const trustOk = !trust.pubKeyId || trust.pubKeyId === kid;
      const ok = signersOk && trustOk;
      checks.push({
        label: "signature",
        ok,
        reason: ok ? `signed by ${kid}` : `signer ${kid} is not accepted`,
      });
    }
  }

  // 3. Freshness — subject commit == HEAD and clean tree.
  if ((policy.freshness ?? "head") === "head") {
    const subject = att.statement.subject[0]?.digest.gitCommit;
    if (!git) {
      checks.push({ label: "freshness", ok: false, reason: "not in a git repository" });
    } else {
      const commitOk = subject === git.commit;
      const ok = commitOk && !git.dirty;
      checks.push({
        label: "freshness",
        ok,
        reason: !commitOk
          ? `attested ${subject?.slice(0, 7)}, HEAD is ${git.commit.slice(0, 7)}`
          : git.dirty
            ? "working tree is dirty"
            : "matches current HEAD, tree clean",
      });
    }
  }

  // 4. Verdict.
  const wantVerdict = req.verdict ?? "verified";
  const state = att.statement.predicate.verdict.state;
  const verdictOk =
    state === "verified" || (wantVerdict === "partial-ok" && state === "partial");
  checks.push({
    label: "verdict",
    ok: verdictOk,
    reason: verdictOk ? `verdict ${state}` : `verdict ${state} does not meet ${wantVerdict}`,
  });

  // 5. Required capabilities × languages.
  const caps = req.capabilities ?? [];
  if (caps.length > 0) {
    const verified = new Set(att.statement.predicate.verdict.verifiedCapabilities);
    const langs = req.languages ?? [];
    const missing: string[] = [];
    for (const cap of caps) {
      if (langs.length === 0) {
        if (!verified.has(cap)) missing.push(cap);
      } else {
        for (const lang of langs) {
          const key = `${cap}:${lang}`;
          if (!verified.has(key)) missing.push(key);
        }
      }
    }
    checks.push({
      label: "coverage",
      ok: missing.length === 0,
      reason: missing.length === 0 ? "all required checks verified" : `not verified: ${missing.join(", ")}`,
    });
  }

  return { passed: checks.every((c) => c.ok), checks };
}
```

- [ ] **Step 4: Run tests, then full suite**

Run: `npx vitest run src/policy/policy.test.ts && npm run verify`
Expected: PASS (all adversarial cases fail the gate as intended).

- [ ] **Step 5: Commit**

```bash
git add src/policy/policy.ts src/policy/policy.test.ts
git commit -m "feat(policy): policy schema + honesty-ordered gate evaluation"
```

---

## Task 5: `veris gate` command

**Files:**
- Create: `src/cli/commands/gate.ts`
- Modify: `src/cli/index.ts`
- Test: `src/cli/commands/gate.test.ts`

**Interfaces:**
- Consumes: `loadPolicy`, `evaluatePolicy` (`../../policy/policy.js`); `latestAttestation` (`../../evidence/store.js`); `gitAnchor` (`../../git/changes.js`); `keyId` (`../../evidence/signing.js`); `isPlain` (`../tty.js`); `readJsonIfExists` (`../../util/fs-safe.js`).
- Produces: `runGate(root, opts?: { policy?: string; attestation?: string; pubkey?: string; keyId?: string }): Promise<number>`.

- [ ] **Step 1: Write the failing test**

Create `src/cli/commands/gate.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAttest } from "./attest.js";
import { runGate } from "./gate.js";

// A real one-commit git repo whose HEAD matches the evidence commit.
function repo(): { root: string; commit: string } {
  const root = mkdtempSync(join(tmpdir(), "veris-gate-"));
  const run = (args: string[]) => execFileSync("git", args, { cwd: root });
  writeFileSync(join(root, "f.txt"), "hi\n");
  run(["init", "-q"]);
  run(["config", "user.email", "t@t.co"]);
  run(["config", "user.name", "t"]);
  run(["add", "."]);
  run(["commit", "-qm", "init"]);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim();
  return { root, commit };
}

describe("runGate", () => {
  it("passes after attest on a clean matching tree (default policy)", async () => {
    const { root } = repo();
    // rebuild the record with a correct digest via the real path:
    const { computeDigest } = await import("../../evidence/record.js");
    const runDir = join(root, ".veris", "runs", "r1");
    mkdirSync(runDir, { recursive: true });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim();
    const base = {
      schema: "veriskit/evidence@1", id: "r1", startedAt: "t",
      tool: { name: "veriskit", version: "0.6.1" },
      git: { commit, branch: "main", dirty: false, changedFiles: 0 },
      env: { os: "linux", node: "v24", pm: "npm", ci: false, timestamp: "t" },
      project: { name: "demo", packageManager: "npm", frameworks: [], languages: ["js"] },
      scope: { kind: "full", changedCount: 0 },
      checks: [],
      verdict: { state: "verified", verifiedCapabilities: ["unit:js"], skipped: [], reasons: [] },
    };
    writeFileSync(join(runDir, "evidence.json"), JSON.stringify({ ...base, digest: computeDigest(base) }));

    expect(await runAttest(root)).toBe(0);
    expect(await runGate(root)).toBe(0);
  }, 30000);

  it("fails when no attestation exists", async () => {
    const { root } = repo();
    expect(await runGate(root)).toBe(1);
  }, 30000);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/cli/commands/gate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/cli/commands/gate.ts`**

```ts
import { readFileSync } from "node:fs";
import pc from "picocolors";
import { latestAttestation } from "../../evidence/store.js";
import { keyId } from "../../evidence/signing.js";
import type { Attestation } from "../../evidence/attestation.js";
import { gitAnchor } from "../../git/changes.js";
import { evaluatePolicy, loadPolicy, type Policy } from "../../policy/policy.js";
import { readJsonIfExists } from "../../util/fs-safe.js";
import { isPlain } from "../tty.js";

export async function runGate(
  root: string,
  opts: { policy?: string; attestation?: string; pubkey?: string; keyId?: string } = {},
): Promise<number> {
  const policy: Policy = opts.policy
    ? ((await readJsonIfExists<Policy>(opts.policy)) ?? {})
    : await loadPolicy(root);

  let att: Attestation;
  if (opts.attestation) {
    const loaded = await readJsonIfExists<Attestation>(opts.attestation);
    if (!loaded) {
      process.stderr.write(`veris: cannot read attestation at ${opts.attestation}\n`);
      return 1;
    }
    att = loaded;
  } else {
    const found = latestAttestation(root);
    if (!found) {
      process.stderr.write("veris: no attestation found — run `veris attest`.\n");
      return 1;
    }
    att = found.att;
  }

  let pubKeyId: string | undefined;
  if (opts.pubkey) {
    try {
      pubKeyId = keyId(readFileSync(opts.pubkey, "utf8"));
    } catch {
      process.stderr.write(`veris: cannot read public key at ${opts.pubkey}\n`);
      return 1;
    }
  } else if (opts.keyId) {
    pubKeyId = opts.keyId;
  }

  const git = await gitAnchor(root);
  const result = evaluatePolicy(att, policy, git, { pubKeyId });

  const plain = isPlain();
  const mark = (ok: boolean) =>
    plain ? (ok ? "ok" : "FAIL") : ok ? pc.green("✓") : pc.red("✗");
  process.stdout.write("Gate checks\n");
  for (const c of result.checks) {
    process.stdout.write(`  ${mark(c.ok)} ${c.label}: ${c.reason}\n`);
  }
  const label = result.passed ? "Gate: passed" : "Gate: FAILED";
  process.stdout.write(
    `\n${plain ? label : result.passed ? pc.green(label) : pc.red(label)}\n`,
  );
  return result.passed ? 0 : 1;
}
```

- [ ] **Step 4: Register `gate` in `src/cli/index.ts`**

```ts
  cli
    .command("gate", "Block unless a valid attestation meets .veris/policy.json")
    .option("--policy <path>", "policy file (default .veris/policy.json)")
    .option("--attestation <path>", "attestation file (default: latest)")
    .option("--pubkey <path>", "require this public key's signer")
    .option("--key-id <id>", "require this key id")
    .action(async (opts) => {
      const { runGate } = await import("./commands/gate.js");
      process.exit(
        await runGate(process.cwd(), {
          policy: opts.policy,
          attestation: opts.attestation,
          pubkey: opts.pubkey,
          keyId: opts.keyId,
        }),
      );
    });
```

- [ ] **Step 5: Run tests, then full suite + dogfood**

Run: `npx vitest run src/cli/commands/gate.test.ts && npm run verify`
Expected: PASS.

Dogfood (clean tree, after `verify` + `attest`):

Run: `node bin/veris gate`
Expected: prints the check list; with the default policy on a clean matching tree it prints `Gate: passed`, exit 0. Then touch a file and re-run: `echo x >> README.md && node bin/veris gate` → `freshness ✗ … working tree is dirty`, `Gate: FAILED`, exit 1. (Restore: `git checkout README.md`.)

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/gate.ts src/cli/commands/gate.test.ts src/cli/index.ts
git commit -m "feat(cli): veris gate — enforce a verification policy against an attestation"
```

---

## Task 6: Docs + starter policy + changelog

**Files:**
- Modify: `src/cli/commands/init.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Test: `src/cli/commands/init.test.ts` (extend if present, else add a focused test)

**Interfaces:**
- Produces: `veris init` writes a starter `.veris/policy.json` if absent (idempotent, via the existing safe-write helper); does NOT gitignore `.veris/attestations/`.

- [ ] **Step 1: Write the failing test**

Add to `src/cli/commands/init.test.ts` (or create it) a check that after `runInit`, `.veris/policy.json` exists and parses to an object with a `require` key:

```ts
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runInit } from "./init.js";

describe("runInit — policy", () => {
  it("writes a starter .veris/policy.json", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-init-pol-"));
    await runInit(root);
    const p = join(root, ".veris", "policy.json");
    expect(existsSync(p)).toBe(true);
    expect(JSON.parse(readFileSync(p, "utf8"))).toHaveProperty("require");
  });
});
```

(If `runInit` takes different arguments, match its real signature.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/cli/commands/init.test.ts`
Expected: FAIL — no `policy.json` written yet.

- [ ] **Step 3: Write the starter policy in `src/cli/commands/init.ts`**

Using the same safe-write helper `init` already uses for other files (e.g. `writeIfAbsent`), write `.veris/policy.json` with:

```jsonc
{
  "require": { "verdict": "verified" },
  "freshness": "head"
}
```

(Follow init's existing pattern for building `.veris` paths and its idempotent write. Do not add `.veris/attestations/` to the gitignore that `init` manages — attestations are shareable proof and should be committable.)

- [ ] **Step 4: Document in `README.md`**

Add a short "Provable verification" section describing:
- `veris attest` — turns the latest `veris verify` into a signed, portable attestation (`.veris/attestations/<id>.att.json`); refuses a dirty tree; signs with `VERISKIT_SIGNING_KEY`/`--key`.
- `veris gate` — passes only when a valid attestation proves the current commit met `.veris/policy.json` (integrity, signer, freshness, verdict, required capabilities×languages); exit 0/1 for CI.
- A minimal policy example and a note that keyless/Sigstore signing is planned.

- [ ] **Step 5: Changelog under `## Unreleased` (no version bump)**

Add to the existing `## Unreleased` block in `CHANGELOG.md` (create the block under `# Changelog` if the polyglot merge is not on this branch), an `### Added` item:

```markdown
- Provable verification. `veris attest` packages the latest `veris verify` into a portable, Ed25519-signed in-toto attestation of the exact commit; `veris gate` blocks unless a valid attestation meets `.veris/policy.json` (integrity, trusted signer, freshness against HEAD, verdict, and required capabilities×languages). No new dependencies. Keyless/Sigstore signing is planned.
```

Confirm `package.json` version is unchanged (`0.6.1`).

- [ ] **Step 6: Full suite + dogfood the whole flow**

Run: `npm run verify`
Expected: PASS.

Run (clean tree): `node bin/veris verify >/dev/null && node bin/veris attest && node bin/veris gate`
Expected: attest writes an attestation; gate prints the checks and `Gate: passed` (or a clear failure if the tree is dirty / policy unmet). Confirm `node -p "require('./package.json').version"` prints `0.6.1`.

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/init.ts src/cli/commands/init.test.ts README.md CHANGELOG.md
git commit -m "docs+init: veris attest/gate docs, starter policy, Unreleased changelog"
```

---

## Self-Review

**Spec coverage:**
- Attestation format (in-toto Statement + evidence predicate, VerisKit signature) → Task 1 ✓ (spec §3)
- `veris attest` (latest evidence, no-repo/dirty guards, sign, write) → Task 3 ✓ (spec §4)
- `.veris/policy.json` schema + loader + default → Task 4 ✓ (spec §6)
- `veris gate` (five honesty-ordered checks, 0/1 exit, report) → Tasks 4+5 ✓ (spec §5, §7)
- Reuse of evidence/signing/git APIs, zero new deps → all tasks ✓
- Docs, starter policy, Unreleased changelog, no version bump → Task 6 ✓ (spec §9 M5)

**Placeholder scan:** none; every step has complete code. ✓

**Type consistency:** `Attestation`/`Statement` shapes fixed in Task 1 and consumed identically in Tasks 2–5; `Policy`/`GateResult` fixed in Task 4 and consumed by Task 5; `runX(root, opts): Promise<number>` command contract uniform; composite-key coverage matching (`cap:lang`) mirrors the model's `checkKey`. ✓

**Adversarial coverage:** tamper, stale commit, dirty tree, partial-vs-verified, missing capability×language, unsigned-when-required, untrusted signer — all asserted to fail the gate (Task 4). ✓

**Deferred to v2 (explicit non-goals):** keyless/Sigstore/Rekor, DSSE-PAE cosign interop, public-consumer `verify-attestation`, agent `--json`/`explain`. Not in this plan.
