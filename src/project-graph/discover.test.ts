import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { discoverFiles } from "./discover.js";

const fx = fileURLToPath(
  new URL("../../test/fixtures/graph-basic", import.meta.url),
);

describe("discoverFiles", () => {
  it("finds code files and classifies test/source/config, skips docs", () => {
    const found = discoverFiles(fx);
    const byFile = Object.fromEntries(found.map((f) => [f.file, f.kind]));
    expect(byFile["a.ts"]).toBe("source");
    expect(byFile["b.ts"]).toBe("source");
    expect(byFile["a.test.ts"]).toBe("test");
    expect(byFile["vitest.config.ts"]).toBe("config");
    expect(byFile["README.md"]).toBeUndefined(); // non-code excluded
  });

  it("excludes test fixture directories but keeps other test files", () => {
    const root = mkdtempSync(join(tmpdir(), "veris-discover-"));
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    mkdirSync(join(root, "test", "helpers"), { recursive: true });
    writeFileSync(join(root, "src", "real.ts"), "export const x = 1;\n");
    writeFileSync(
      join(root, "test", "fixtures", "data.ts"),
      "export const fixture = true;\n",
    );
    writeFileSync(
      join(root, "test", "helpers", "util.ts"),
      "export function helper() {}\n",
    );

    const found = discoverFiles(root);
    const byFile = Object.fromEntries(found.map((f) => [f.file, f.kind]));

    expect(byFile["src/real.ts"]).toBe("source");
    expect(byFile["test/fixtures/data.ts"]).toBeUndefined();
    expect(byFile["test/helpers/util.ts"]).toBe("test");
  });
});
