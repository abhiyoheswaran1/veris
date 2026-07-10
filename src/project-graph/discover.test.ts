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
});
