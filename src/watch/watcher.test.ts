import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { watch } from "./watcher.js";

function onceBatch(dir: string, opts = {}): Promise<string[]> {
  return new Promise((resolve) => {
    const stop = watch(
      dir,
      { debounceMs: 40, pollIntervalMs: 40, ...opts },
      (batch) => {
        stop();
        resolve(batch);
      },
    );
    setTimeout(
      () => writeFileSync(join(dir, "changed.ts"), "export const x = 1;\n"),
      60,
    );
  });
}

describe("watch", () => {
  it("emits a debounced batch on a file change (fs.watch)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-watch-"));
    const batch = await onceBatch(dir);
    expect(batch.some((p) => p.includes("changed.ts"))).toBe(true);
  }, 5000);

  it("emits a batch in poll mode", async () => {
    const dir = mkdtempSync(join(tmpdir(), "veris-watch-"));
    const batch = await onceBatch(dir, { poll: true });
    expect(batch.some((p) => p.includes("changed.ts"))).toBe(true);
  }, 5000);
});
