# Polyglot Verification — Milestone 2: Python/Go Detection + Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect Python and Go projects alongside JS, choose each capability's tool by presence + preference + config override, and surface the full (capability × language) matrix in `doctor` — without running any Python/Go tool yet (adapters are M3–M4).

**Architecture:** M1 made the model keyed by `(capability × language)`. This milestone teaches *detection* to emit Python and Go capabilities. A new `resolveBin`/`binExists` utility locates language tools (JS → `node_modules/.bin`; Python → `.venv`/`venv`/PATH; Go → PATH). Two pure detector modules (`detect-python.ts`, `detect-go.ts`) return `Capability[]`, wired into `detectProject`, gated by a new config schema (`languages` enable/disable, `tools` override). Because no Python/Go runner is registered until M3/M4, a detected Python/Go capability that reaches `verify` is reported `skipped — no runner registered` (honest, expected intermediate state on this branch). JS-only repos have no Python/Go markers, so their detection and `verify` behavior are unchanged.

**Tech Stack:** TypeScript (strict, ESM, `.js` specifiers), Vitest, Biome. No new dependencies (Node built-ins only).

## Global Constraints

- **No new runtime dependencies** — Node built-ins only (`node:fs`, `node:path`).
- **ESM import specifiers end in `.js`.**
- **`veriskit`/`VerisKit` naming.**
- **JS-only repos unchanged:** a repo with no `pyproject.toml`/`setup.py`/`setup.cfg`/`requirements.txt` and no `go.mod` must produce exactly the same `Project.capabilities`, `verify` output, and exit code as before this milestone.
- **Detection only:** do NOT register runners, run any tool, or change reporter/verify display in this milestone. `doctor` display IS in scope.
- **Runner-name vocabulary (emitted as `Capability.runner`, matched to the registry in M3/M4):** python → `pytest` (unit), `mypy`/`pyright` (types), `ruff`/`flake8`/`pylint` (lint); go → `go-test` (unit), `go-build` (types), `golangci-lint`/`go-vet` (lint).
- **Honesty:** a language detected but its tool absent → `available: false` with a clear `reason` (not omitted). A language disabled in config → omitted entirely.
- **Every task ends green:** `npm run verify` passes before each commit.
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure

- `src/util/resolve-bin.ts` — NEW: `resolveBin(root, language, name)` and `binExists(root, language, name)`.
- `src/config/load.ts` — extend `VerisConfig` with `languages` + `tools`.
- `src/config/detect-python.ts` — NEW: `detectPython(root, config): Capability[]`.
- `src/config/detect-go.ts` — NEW: `detectGo(root, config): Capability[]`.
- `src/config/detect.ts` — wire Python/Go detectors + config into `detectProject`.
- `src/cli/commands/doctor.ts` — render the language for each capability.
- Test files alongside each.

---

## Task 1: `resolveBin` / `binExists` tool-location utility

**Files:**
- Create: `src/util/resolve-bin.ts`
- Test: `src/util/resolve-bin.test.ts`

**Interfaces:**
- Consumes: `Language` from `../core/model.js`.
- Produces:
  - `resolveBin(root: string, language: Language, name: string): string` — the command to spawn. JS → `<root>/node_modules/.bin/<name>`; Python → first existing of `<root>/.venv/bin/<name>`, `<root>/venv/bin/<name>`, else bare `<name>`; Go → bare `<name>`.
  - `binExists(root: string, language: Language, name: string): boolean` — whether the tool is installed (checks language search dirs, then PATH; on win32 also tries `.exe`/`.cmd`/`.bat`).

- [ ] **Step 1: Write the failing test**

Create `src/util/resolve-bin.test.ts`:

```ts
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { binExists, resolveBin } from "./resolve-bin.js";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "veris-bin-"));
}

describe("resolveBin", () => {
  it("returns the node_modules/.bin path for js", () => {
    const root = tmp();
    expect(resolveBin(root, "js", "tsc")).toBe(
      join(root, "node_modules", ".bin", "tsc"),
    );
  });

  it("prefers a .venv path for python when it exists", () => {
    const root = tmp();
    mkdirSync(join(root, ".venv", "bin"), { recursive: true });
    writeFileSync(join(root, ".venv", "bin", "pytest"), "#!/bin/sh\n");
    expect(resolveBin(root, "python", "pytest")).toBe(
      join(root, ".venv", "bin", "pytest"),
    );
  });

  it("falls back to the bare name for python without a venv", () => {
    const root = tmp();
    expect(resolveBin(root, "python", "pytest")).toBe("pytest");
  });

  it("returns the bare name for go", () => {
    expect(resolveBin(tmp(), "go", "go")).toBe("go");
  });
});

describe("binExists", () => {
  it("finds a python tool inside .venv/bin", () => {
    const root = tmp();
    const bin = join(root, ".venv", "bin");
    mkdirSync(bin, { recursive: true });
    const p = join(bin, "mypy");
    writeFileSync(p, "#!/bin/sh\n");
    chmodSync(p, 0o755);
    expect(binExists(root, "python", "mypy")).toBe(true);
  });

  it("returns false when the tool is nowhere", () => {
    expect(binExists(tmp(), "python", "definitely-not-installed-xyz")).toBe(
      false,
    );
  });

  it("finds a tool on PATH", () => {
    const root = tmp();
    const dir = mkdtempSync(join(tmpdir(), "veris-path-"));
    const p = join(dir, "faketool");
    writeFileSync(p, "#!/bin/sh\n");
    chmodSync(p, 0o755);
    const prev = process.env.PATH;
    process.env.PATH = `${dir}`;
    try {
      expect(binExists(root, "go", "faketool")).toBe(true);
    } finally {
      process.env.PATH = prev;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/util/resolve-bin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/util/resolve-bin.ts`**

```ts
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Language } from "../core/model.js";

// Language-specific directories to search first, most-preferred first.
function searchDirs(root: string, language: Language): string[] {
  if (language === "js") return [join(root, "node_modules", ".bin")];
  if (language === "python")
    return [join(root, ".venv", "bin"), join(root, "venv", "bin")];
  return []; // go: PATH only
}

function pathDirs(): string[] {
  return (process.env.PATH ?? "").split(delimiter).filter(Boolean);
}

// Executable name variants to try (Windows appends common extensions).
function nameVariants(name: string): string[] {
  if (process.platform !== "win32") return [name];
  return [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`];
}

// Resolve a tool to a concrete command string. JS always yields the
// node_modules/.bin path (identical to the old localBin). Python yields a venv
// path when present, else the bare name (resolved via PATH at spawn time). Go
// always yields the bare name.
export function resolveBin(
  root: string,
  language: Language,
  name: string,
): string {
  for (const dir of searchDirs(root, language)) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  if (language === "js") return join(root, "node_modules", ".bin", name);
  return name;
}

// Whether a tool is actually installed and runnable.
export function binExists(
  root: string,
  language: Language,
  name: string,
): boolean {
  const dirs = [...searchDirs(root, language), ...pathDirs()];
  for (const dir of dirs) {
    for (const variant of nameVariants(name)) {
      if (existsSync(join(dir, variant))) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/util/resolve-bin.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm run verify`
Expected: PASS.

```bash
git add src/util/resolve-bin.ts src/util/resolve-bin.test.ts
git commit -m "feat(util): resolveBin/binExists for locating per-language tools"
```

---

## Task 2: Extend the config schema

**Files:**
- Modify: `src/config/load.ts`
- Test: `src/config/load.test.ts` (extend)

**Interfaces:**
- Consumes: `Language`, `CapabilityId` from `../core/model.js`.
- Produces: `VerisConfig` gains
  - `languages?: Partial<Record<Language, boolean>>` — enable/disable a detected language (absent ⇒ enabled).
  - `tools?: Partial<Record<Language, Partial<Record<CapabilityId, string>>>>` — force a specific tool for a (language, capability).

- [ ] **Step 1: Write the failing test**

Add to `src/config/load.test.ts` (create the file if it does not exist; keep any existing tests):

```ts
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./load.js";

describe("loadConfig — polyglot fields", () => {
  it("reads languages and tools overrides", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-cfg-"));
    mkdirSync(join(root, ".veris"), { recursive: true });
    writeFileSync(
      join(root, ".veris", "config.json"),
      JSON.stringify({
        languages: { python: true, go: false },
        tools: { python: { lint: "flake8" } },
      }),
    );
    const cfg = await loadConfig(root);
    expect(cfg?.languages?.go).toBe(false);
    expect(cfg?.tools?.python?.lint).toBe("flake8");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/config/load.test.ts`
Expected: FAIL — TypeScript errors on `cfg.languages` / `cfg.tools` (properties don't exist).

- [ ] **Step 3: Extend `VerisConfig` in `src/config/load.ts`**

```ts
import { join } from "node:path";
import type { CapabilityId, Language } from "../core/model.js";
import { readJsonIfExists } from "../util/fs-safe.js";

export interface VerisConfig {
  checks?: CapabilityId[];
  languages?: Partial<Record<Language, boolean>>;
  tools?: Partial<Record<Language, Partial<Record<CapabilityId, string>>>>;
}

export async function loadConfig(root: string): Promise<VerisConfig | null> {
  return readJsonIfExists<VerisConfig>(join(root, ".veris", "config.json"));
}
```

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/config/load.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/load.ts src/config/load.test.ts
git commit -m "feat(config): add languages + tools polyglot config fields"
```

---

## Task 3: Python detector

**Files:**
- Create: `src/config/detect-python.ts`
- Test: `src/config/detect-python.test.ts`

**Interfaces:**
- Consumes: `Capability`, `CapabilityId` from `../core/model.js`; `VerisConfig` from `./load.js`; `binExists` from `../util/resolve-bin.js`.
- Produces: `detectPython(root: string, config?: VerisConfig | null): Capability[]` — returns `[]` when no Python marker is present OR Python is disabled in config; otherwise one `Capability` (`language: "python"`) per capability id `unit`/`types`/`lint`, `available` iff the chosen tool is installed.

**Selection policy (presence-first, then preference order, config override wins):**
- `unit` candidates: `["pytest"]`
- `types` candidates: `["mypy", "pyright"]`
- `lint` candidates: `["ruff", "flake8", "pylint"]`

- [ ] **Step 1: Write the failing test**

Create `src/config/detect-python.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectPython } from "./detect-python.js";

function pyRepo(markers: string[] = ["pyproject.toml"]): string {
  const root = mkdtempSync(join(tmpdir(), "veris-py-"));
  for (const m of markers) writeFileSync(join(root, m), "");
  return root;
}

function installVenvTool(root: string, name: string): void {
  const bin = join(root, ".venv", "bin");
  mkdirSync(bin, { recursive: true });
  const p = join(bin, name);
  writeFileSync(p, "#!/bin/sh\n");
  chmodSync(p, 0o755);
}

describe("detectPython", () => {
  it("returns [] when there is no python marker", () => {
    const root = mkdtempSync(join(tmpdir(), "veris-none-"));
    expect(detectPython(root)).toEqual([]);
  });

  it("returns [] when python is disabled in config", () => {
    const root = pyRepo();
    expect(detectPython(root, { languages: { python: false } })).toEqual([]);
  });

  it("marks unit available with pytest when pytest is installed", () => {
    const root = pyRepo();
    installVenvTool(root, "pytest");
    const caps = detectPython(root);
    const unit = caps.find((c) => c.id === "unit");
    expect(unit).toMatchObject({
      id: "unit",
      language: "python",
      available: true,
      runner: "pytest",
    });
  });

  it("marks unit unavailable with a reason when pytest is missing", () => {
    const root = pyRepo();
    const unit = detectPython(root).find((c) => c.id === "unit");
    expect(unit?.available).toBe(false);
    expect(unit?.reason).toContain("pytest");
  });

  it("prefers mypy over pyright for types", () => {
    const root = pyRepo();
    installVenvTool(root, "mypy");
    installVenvTool(root, "pyright");
    const types = detectPython(root).find((c) => c.id === "types");
    expect(types?.runner).toBe("mypy");
  });

  it("honors a tools override for lint", () => {
    const root = pyRepo();
    installVenvTool(root, "flake8");
    const lint = detectPython(root, {
      tools: { python: { lint: "flake8" } },
    }).find((c) => c.id === "lint");
    expect(lint).toMatchObject({ runner: "flake8", available: true });
  });

  it("detects via requirements.txt too", () => {
    const root = pyRepo(["requirements.txt"]);
    expect(detectPython(root).length).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/config/detect-python.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config/detect-python.ts`**

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Capability, CapabilityId } from "../core/model.js";
import { binExists } from "../util/resolve-bin.js";
import type { VerisConfig } from "./load.js";

const MARKERS = [
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "requirements.txt",
];

const CANDIDATES: Record<"unit" | "types" | "lint", string[]> = {
  unit: ["pytest"],
  types: ["mypy", "pyright"],
  lint: ["ruff", "flake8", "pylint"],
};

function isPython(root: string): boolean {
  return MARKERS.some((m) => existsSync(join(root, m)));
}

// Choose a tool for one capability: a config override wins (even if absent —
// availability then reflects whether it is installed); otherwise the first
// installed candidate in preference order; otherwise the first candidate as the
// "expected but missing" tool for the skip reason.
function pick(
  root: string,
  id: CapabilityId,
  candidates: string[],
  override: string | undefined,
): Capability {
  if (override) {
    const available = binExists(root, "python", override);
    return {
      id,
      language: "python",
      available,
      runner: override,
      ...(available
        ? {}
        : { reason: `Python detected; configured ${override} not installed` }),
    };
  }
  for (const tool of candidates) {
    if (binExists(root, "python", tool)) {
      return { id, language: "python", available: true, runner: tool };
    }
  }
  const expected = candidates.join(" / ");
  return {
    id,
    language: "python",
    available: false,
    reason: `Python detected; no ${id} tool installed (looked for ${expected})`,
  };
}

export function detectPython(
  root: string,
  config?: VerisConfig | null,
): Capability[] {
  if (!isPython(root)) return [];
  if (config?.languages?.python === false) return [];
  const overrides = config?.tools?.python ?? {};
  return (["unit", "types", "lint"] as const).map((id) =>
    pick(root, id, CANDIDATES[id], overrides[id]),
  );
}
```

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/config/detect-python.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/detect-python.ts src/config/detect-python.test.ts
git commit -m "feat(detect): Python capability detection with tool-choice policy"
```

---

## Task 4: Go detector

**Files:**
- Create: `src/config/detect-go.ts`
- Test: `src/config/detect-go.test.ts`

**Interfaces:**
- Consumes: `Capability` from `../core/model.js`; `VerisConfig` from `./load.js`; `binExists` from `../util/resolve-bin.js`.
- Produces: `detectGo(root: string, config?: VerisConfig | null): Capability[]` — `[]` when no `go.mod` OR Go disabled; otherwise `unit` (`go-test`), `types` (`go-build`), `lint` (`golangci-lint` if installed, else `go-vet`). `unit`/`types` are available iff the `go` toolchain is installed; `lint` available iff `golangci-lint` or `go` is installed.

- [ ] **Step 1: Write the failing test**

Create `src/config/detect-go.test.ts`:

```ts
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectGo } from "./detect-go.js";

function goRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "veris-go-"));
  writeFileSync(join(root, "go.mod"), "module x\n\ngo 1.22\n");
  return root;
}

function fakeToolOnPath(name: string): { dir: string; restore: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "veris-gopath-"));
  const p = join(dir, name);
  writeFileSync(p, "#!/bin/sh\n");
  chmodSync(p, 0o755);
  const prev = process.env.PATH;
  process.env.PATH = `${dir}${process.platform === "win32" ? ";" : ":"}${prev ?? ""}`;
  return { dir, restore: () => (process.env.PATH = prev) };
}

describe("detectGo", () => {
  it("returns [] without a go.mod", () => {
    expect(detectGo(mkdtempSync(join(tmpdir(), "veris-nogo-")))).toEqual([]);
  });

  it("returns [] when go is disabled in config", () => {
    expect(detectGo(goRepo(), { languages: { go: false } })).toEqual([]);
  });

  it("emits go-test/go-build/lint capabilities when go is installed", () => {
    const { restore } = fakeToolOnPath("go");
    try {
      const caps = detectGo(goRepo());
      expect(caps.find((c) => c.id === "unit")).toMatchObject({
        language: "go",
        available: true,
        runner: "go-test",
      });
      expect(caps.find((c) => c.id === "types")?.runner).toBe("go-build");
      // no golangci-lint installed → falls back to go-vet
      expect(caps.find((c) => c.id === "lint")?.runner).toBe("go-vet");
    } finally {
      restore();
    }
  });

  it("prefers golangci-lint for lint when installed", () => {
    const go = fakeToolOnPath("go");
    const lint = fakeToolOnPath("golangci-lint");
    try {
      const caps = detectGo(goRepo());
      expect(caps.find((c) => c.id === "lint")?.runner).toBe("golangci-lint");
    } finally {
      lint.restore();
      go.restore();
    }
  });

  it("marks capabilities unavailable when the go toolchain is missing", () => {
    // Ensure 'go' is not resolvable by pointing PATH at an empty dir.
    const empty = mkdtempSync(join(tmpdir(), "veris-empty-"));
    const prev = process.env.PATH;
    process.env.PATH = empty;
    try {
      const caps = detectGo(goRepo());
      expect(caps.find((c) => c.id === "unit")?.available).toBe(false);
      expect(caps.find((c) => c.id === "unit")?.reason).toContain("go");
    } finally {
      process.env.PATH = prev;
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/config/detect-go.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config/detect-go.ts`**

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Capability } from "../core/model.js";
import { binExists } from "../util/resolve-bin.js";
import type { VerisConfig } from "./load.js";

function isGo(root: string): boolean {
  return existsSync(join(root, "go.mod"));
}

export function detectGo(
  root: string,
  config?: VerisConfig | null,
): Capability[] {
  if (!isGo(root)) return [];
  if (config?.languages?.go === false) return [];
  const overrides = config?.tools?.go ?? {};
  const hasGo = binExists(root, "go", "go");

  const unit: Capability = hasGo
    ? { id: "unit", language: "go", available: true, runner: "go-test" }
    : {
        id: "unit",
        language: "go",
        available: false,
        runner: "go-test",
        reason: "Go detected; the go toolchain is not installed",
      };

  const types: Capability = hasGo
    ? { id: "types", language: "go", available: true, runner: "go-build" }
    : {
        id: "types",
        language: "go",
        available: false,
        runner: "go-build",
        reason: "Go detected; the go toolchain is not installed",
      };

  const lintTool =
    overrides.lint ??
    (binExists(root, "go", "golangci-lint") ? "golangci-lint" : "go-vet");
  const lintAvailable =
    lintTool === "go-vet" ? hasGo : binExists(root, "go", lintTool);
  const lint: Capability = lintAvailable
    ? { id: "lint", language: "go", available: true, runner: lintTool }
    : {
        id: "lint",
        language: "go",
        available: false,
        runner: lintTool,
        reason: `Go detected; ${lintTool} is not installed`,
      };

  return [unit, types, lint];
}
```

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/config/detect-go.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/detect-go.ts src/config/detect-go.test.ts
git commit -m "feat(detect): Go capability detection with tool-choice policy"
```

---

## Task 5: Wire Python/Go detection into `detectProject`

**Files:**
- Modify: `src/config/detect.ts`
- Test: `src/config/detect.test.ts` (extend — this file exists)

**Interfaces:**
- Consumes: `detectPython` (`./detect-python.js`), `detectGo` (`./detect-go.js`), `loadConfig`/`VerisConfig` (`./load.js`).
- Produces: `detectProject(root: string, config?: VerisConfig | null): Promise<Project>` — signature gains an optional `config`; when omitted it loads via `loadConfig(root)`. `capabilities` now includes Python/Go capabilities; `languages` includes `"python"`/`"go"` when their markers are present and the language is not disabled.

- [ ] **Step 1: Write the failing test**

Add to `src/config/detect.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectProject } from "./detect.js";

describe("detectProject — polyglot", () => {
  it("adds go capabilities and language when go.mod is present", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-poly-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
    writeFileSync(join(root, "go.mod"), "module x\n\ngo 1.22\n");
    const project = await detectProject(root);
    expect(project.languages).toContain("go");
    expect(
      project.capabilities.some((c) => c.language === "go" && c.id === "unit"),
    ).toBe(true);
  });

  it("omits a disabled language entirely", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-poly2-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
    writeFileSync(join(root, "go.mod"), "module x\n\ngo 1.22\n");
    const project = await detectProject(root, { languages: { go: false } });
    expect(project.languages).not.toContain("go");
    expect(project.capabilities.some((c) => c.language === "go")).toBe(false);
  });

  it("leaves a pure-js repo's capabilities unchanged (js only)", async () => {
    const root = mkdtempSync(join(tmpdir(), "veris-js-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x" }));
    const project = await detectProject(root);
    expect(project.capabilities.every((c) => c.language === "js")).toBe(true);
    expect(project.languages).not.toContain("python");
    expect(project.languages).not.toContain("go");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/config/detect.test.ts`
Expected: FAIL — `detectProject` does not yet add Go capabilities / accept a config arg.

- [ ] **Step 3: Wire the detectors into `src/config/detect.ts`**

Add imports at the top:

```ts
import { detectGo } from "./detect-go.js";
import { detectPython } from "./detect-python.js";
import { loadConfig, type VerisConfig } from "./load.js";
```

Change `detectProject` to accept and apply config, and merge the new capabilities:

```ts
export async function detectProject(
  root: string,
  config?: VerisConfig | null,
): Promise<Project> {
  const cfg = config ?? (await loadConfig(root));
  const pkg =
    (await readJsonIfExists<PkgJson>(join(root, "package.json"))) ?? {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (name: string) => name in deps;
  const scripts = pkg.scripts ?? {};

  const jsLanguages = existsSync(join(root, "tsconfig.json"))
    ? ["typescript", "javascript"]
    : ["javascript"];
  const frameworks = ["next", "vite", "react"].filter(has);

  const jsCapabilities: Capability[] = [
    detectTypes(root, has),
    detectUnit(has, scripts),
    detectLint(root, has),
    detectBrowser(root, has),
  ];

  const pythonCapabilities = detectPython(root, cfg);
  const goCapabilities = detectGo(root, cfg);

  const languages = [
    ...jsLanguages,
    ...(pythonCapabilities.length ? ["python"] : []),
    ...(goCapabilities.length ? ["go"] : []),
  ];

  return {
    root,
    name: pkg.name ?? undefined,
    packageManager: detectPackageManager(root),
    frameworks,
    languages,
    scripts,
    capabilities: [
      ...jsCapabilities,
      ...pythonCapabilities,
      ...goCapabilities,
    ],
  };
}
```

(The JS detector helpers `detectTypes`/`detectUnit`/`detectLint`/`detectBrowser` are unchanged.)

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/config/detect.test.ts && npm run verify`
Expected: PASS. The pure-js assertion confirms no JS-repo regression.

- [ ] **Step 5: Commit**

```bash
git add src/config/detect.ts src/config/detect.test.ts
git commit -m "feat(detect): merge Python/Go capabilities into detectProject"
```

---

## Task 6: `doctor` renders the language matrix

**Files:**
- Modify: `src/cli/commands/doctor.ts`
- Test: `src/cli/commands/doctor.test.ts` (create if absent, else extend)

**Interfaces:**
- Produces: each capability row in `doctor` shows its language, e.g. `✓ unit (python)   via pytest` and `⊘ lint (go)   skipped — …`.

- [ ] **Step 1: Write the failing test**

Create/extend `src/cli/commands/doctor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { EnvironmentInfo, Project } from "../../core/model.js";
import { renderDoctor } from "./doctor.js";

const env: EnvironmentInfo = {
  os: "linux",
  node: "v24.0.0",
  pm: "npm",
  ci: false,
  timestamp: "2026-07-17T00:00:00.000Z",
};

describe("renderDoctor — polyglot matrix", () => {
  it("shows the language beside each capability", () => {
    const project: Project = {
      root: "/x",
      packageManager: "npm",
      frameworks: [],
      languages: ["javascript", "python"],
      scripts: {},
      capabilities: [
        { id: "unit", language: "js", available: true, runner: "vitest" },
        { id: "unit", language: "python", available: true, runner: "pytest" },
        {
          id: "lint",
          language: "python",
          available: false,
          runner: "ruff",
          reason: "Python detected; no lint tool installed (looked for ruff / flake8 / pylint)",
        },
      ],
    };
    const out = renderDoctor(project, env);
    expect(out).toContain("unit (js)");
    expect(out).toContain("unit (python)");
    expect(out).toContain("via pytest");
    expect(out).toContain("lint (python)");
    expect(out).toContain("skipped");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/cli/commands/doctor.test.ts`
Expected: FAIL — current output prints `c.id` without the language.

- [ ] **Step 3: Add the language to each row in `src/cli/commands/doctor.ts`**

Replace the capabilities loop body:

```ts
  lines.push("Capabilities");
  for (const c of project.capabilities) {
    const label = `${c.id} (${c.language})`;
    if (c.available) {
      lines.push(`  ${ok("✓")} ${label.padEnd(16)} ${dim(`via ${c.runner}`)}`);
    } else {
      lines.push(
        `  ${dim("⊘")} ${label.padEnd(16)} ${dim(`skipped — ${c.reason}`)}`,
      );
    }
  }
```

- [ ] **Step 4: Run to verify pass, then full suite**

Run: `npx vitest run src/cli/commands/doctor.test.ts && npm run verify`
Expected: PASS.

- [ ] **Step 5: Dogfood**

Run: `node bin/veris doctor` in this repo (JS-only).
Expected: capability rows now read `types (js)`, `unit (js)`, `lint (js)`, `browser (js)` — the language is shown, everything else intact.

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/doctor.ts src/cli/commands/doctor.test.ts
git commit -m "feat(doctor): show the language of each capability"
```

---

## Self-Review

**Spec coverage (M2 scope — spec §4):**
- Python detection via pyproject/setup.py/setup.cfg/requirements.txt → Task 3 ✓
- Go detection via go.mod → Task 4 ✓
- Tool-choice policy (presence-first, preference order, config override) → Tasks 3, 4 ✓
- `resolveBin`/`binExists` with JS `node_modules/.bin`, Python `.venv`/`venv`/PATH, Go PATH → Task 1 ✓
- Config schema: `languages` enable/disable + `tools` override → Task 2, applied in Tasks 3–5 ✓
- Disabled language omitted; detected-but-missing tool → available:false with reason → Tasks 3, 4, 5 ✓
- `doctor` reports the polyglot matrix → Task 6 ✓
- JS-only repos unchanged → Task 5 Step 1 assertion + Task 6 dogfood ✓
- No runners registered / no tool executed (deferred to M3–M4) ✓

**Placeholder scan:** none. Every code step is complete. ✓

**Type consistency:** `detectPython`/`detectGo` return `Capability[]`; `detectProject(root, config?)` optional-config signature used consistently; `VerisConfig.languages`/`tools` shapes match their use in the detectors; runner-name vocabulary (`pytest`/`mypy`/`pyright`/`ruff`/`flake8`/`pylint`/`go-test`/`go-build`/`golangci-lint`/`go-vet`) fixed here and consumed by M3/M4. ✓

**Deferred (out of scope):** the runner adapters + registry entries (M3 Python, M4 Go), verify/reporter language display (M5), polyglot import-graph `affected` (later).
