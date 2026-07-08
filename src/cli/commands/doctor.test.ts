import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectProject } from "../../config/detect.js";
import { getEnvironmentInfo } from "../../util/env.js";
import { renderDoctor } from "./doctor.js";

const fx = (n: string) =>
  fileURLToPath(new URL(`../../../test/fixtures/${n}`, import.meta.url));

describe("renderDoctor", () => {
  it("lists each capability and its runner or skip reason", async () => {
    const p = await detectProject(fx("vitest-ts"));
    const out = renderDoctor(p, getEnvironmentInfo(p.packageManager));
    expect(out).toContain("unit");
    expect(out).toContain("vitest");
    expect(out).toContain("types");
  });

  it("shows skip reasons for a bare project", async () => {
    const p = await detectProject(fx("bare-js"));
    const out = renderDoctor(p, getEnvironmentInfo(p.packageManager));
    expect(out).toContain("no test runner detected");
  });
});
