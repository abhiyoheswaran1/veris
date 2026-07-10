import { describe, expect, it } from "vitest";
import { exec } from "./exec.js";

describe("exec", () => {
  // These spawn real node subprocesses; process startup can exceed the default
  // 5s test timeout when the whole suite runs in parallel, so give them room.
  it("captures stdout and exit code 0", async () => {
    const r = await exec(process.execPath, [
      "-e",
      "process.stdout.write('hi')",
    ]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("hi");
    expect(r.timedOut).toBe(false);
  }, 20000);

  it("reports non-zero exit code", async () => {
    const r = await exec(process.execPath, ["-e", "process.exit(3)"]);
    expect(r.code).toBe(3);
  }, 20000);
});
