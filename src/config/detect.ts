import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Capability, PackageManager, Project } from "../core/model.js";
import { readJsonIfExists } from "../util/fs-safe.js";

interface PkgJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function detectPackageManager(root: string): PackageManager {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lockb"))) return "bun";
  return "npm";
}

export async function detectProject(root: string): Promise<Project> {
  const pkg =
    (await readJsonIfExists<PkgJson>(join(root, "package.json"))) ?? {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (name: string) => name in deps;
  const scripts = pkg.scripts ?? {};

  const languages = existsSync(join(root, "tsconfig.json"))
    ? ["typescript", "javascript"]
    : ["javascript"];
  const frameworks = ["next", "vite", "react"].filter(has);

  const capabilities: Capability[] = [
    detectTypes(root, has),
    detectUnit(has, scripts),
    detectLint(root, has),
    detectBrowser(root, has),
  ];

  return {
    root,
    name: pkg.name ?? undefined,
    packageManager: detectPackageManager(root),
    frameworks,
    languages,
    scripts,
    capabilities,
  };
}

function detectTypes(root: string, has: (n: string) => boolean): Capability {
  if (existsSync(join(root, "tsconfig.json")) && has("typescript"))
    return { id: "types", available: true, runner: "tsc" };
  return {
    id: "types",
    available: false,
    reason: "no tsconfig.json + typescript dependency",
  };
}

function detectUnit(
  has: (n: string) => boolean,
  scripts: Record<string, string>,
): Capability {
  if (has("vitest")) return { id: "unit", available: true, runner: "vitest" };
  if (has("jest")) return { id: "unit", available: true, runner: "jest" };
  if (Object.values(scripts).some((s) => s.includes("node --test")))
    return { id: "unit", available: true, runner: "node-test" };
  return { id: "unit", available: false, reason: "no test runner detected" };
}

function detectLint(root: string, has: (n: string) => boolean): Capability {
  if (existsSync(join(root, "biome.json")) || has("@biomejs/biome"))
    return { id: "lint", available: true, runner: "biome" };
  if (
    has("eslint") ||
    [".eslintrc", ".eslintrc.json", ".eslintrc.cjs", "eslint.config.js"].some(
      (f) => existsSync(join(root, f)),
    )
  )
    return { id: "lint", available: true, runner: "eslint" };
  return { id: "lint", available: false, reason: "no linter configured" };
}

function detectBrowser(root: string, has: (n: string) => boolean): Capability {
  if (has("@playwright/test") || existsSync(join(root, "playwright.config.ts")))
    return {
      id: "browser",
      available: false,
      runner: "playwright",
      reason: "detected; browser execution deferred to v0.5",
    };
  return {
    id: "browser",
    available: false,
    reason: "no browser runner configured",
  };
}
