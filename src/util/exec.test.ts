import { describe, expect, it } from "vitest";
import { exec } from "./exec.js";

describe("exec", () => {
  it("captures stdout and exit code 0", async () => {
    const r = await exec(process.execPath, [
      "-e",
      "process.stdout.write('hi')",
    ]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("hi");
    expect(r.timedOut).toBe(false);
  });

  it("reports non-zero exit code", async () => {
    const r = await exec(process.execPath, ["-e", "process.exit(3)"]);
    expect(r.code).toBe(3);
  });
});
