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
