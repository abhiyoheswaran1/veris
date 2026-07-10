import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractSpecifiers, scannerImports } from "./scanner-resolver.js";

const fx = fileURLToPath(
  new URL("../../test/fixtures/graph-basic", import.meta.url),
);

describe("scanner-resolver", () => {
  it("extracts import/require/dynamic specifiers", () => {
    const specs = extractSpecifiers(
      `import x from "./a.js";\nconst y = require("./b");\nawait import("./c.js");\nexport { z } from "./d.js";`,
    );
    expect(specs).toEqual(["./a.js", "./b", "./c.js", "./d.js"]);
  });

  it("resolves a relative .js import to its .ts sibling", () => {
    // b.ts imports "./a.js" which is really a.ts
    expect(scannerImports(fx, "b.ts")).toEqual(["a.ts"]);
  });

  it("ignores bare (node_modules) specifiers", () => {
    // a.test.ts imports "vitest" (bare) + "./a.js" (relative) → only a.ts resolves
    expect(scannerImports(fx, "a.test.ts")).toEqual(["a.ts"]);
  });
});
