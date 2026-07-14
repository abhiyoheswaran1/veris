import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

describe("server.json", () => {
  it("names match package.json and the npm identifier", () => {
    const manifest = JSON.parse(readFileSync(here("./server.json"), "utf8"));
    const pkg = JSON.parse(readFileSync(here("./package.json"), "utf8"));
    expect(manifest.name).toBe(pkg.mcpName);
    expect(manifest.version).toBe(pkg.version);
    const npm = manifest.packages.find(
      (p: { registryType: string }) => p.registryType === "npm",
    );
    expect(npm.identifier).toBe(pkg.name);
    expect(npm.transport.type).toBe("stdio");
  });
});
