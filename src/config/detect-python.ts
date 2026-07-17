import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Capability, CapabilityId } from "../core/model.js";
import { binExists } from "../util/resolve-bin.js";
import type { VerisConfig } from "./load.js";

const MARKERS = ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"];

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
