import { accessSync, constants, existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Language } from "../core/model.js";

// Language-specific directories to search first, most-preferred first.
function searchDirs(root: string, language: Language): string[] {
  if (language === "js") return [join(root, "node_modules", ".bin")];
  if (language === "python")
    return [join(root, ".venv", "bin"), join(root, "venv", "bin")];
  return []; // go: PATH only
}

function pathDirs(): string[] {
  return (process.env.PATH ?? "").split(delimiter).filter(Boolean);
}

// Executable name variants to try (Windows appends common extensions).
function nameVariants(name: string): string[] {
  if (process.platform !== "win32") return [name];
  return [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`];
}

// True only for a regular file that is executable. On Windows an extension
// match (via nameVariants) implies executability, so isFile() is enough.
function isExecutableFile(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false;
    if (process.platform === "win32") return true;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Resolve a tool to a concrete command string. JS always yields the
// node_modules/.bin path (identical to the old localBin). Python yields a venv
// path when present, else the bare name (resolved via PATH at spawn time). Go
// always yields the bare name.
export function resolveBin(
  root: string,
  language: Language,
  name: string,
): string {
  for (const dir of searchDirs(root, language)) {
    for (const variant of nameVariants(name)) {
      const p = join(dir, variant);
      if (existsSync(p)) return p;
    }
  }
  if (language === "js") return join(root, "node_modules", ".bin", name);
  return name;
}

// Whether a tool is actually installed and runnable.
export function binExists(
  root: string,
  language: Language,
  name: string,
): boolean {
  for (const dir of [...searchDirs(root, language), ...pathDirs()]) {
    for (const variant of nameVariants(name)) {
      if (isExecutableFile(join(dir, variant))) return true;
    }
  }
  return false;
}
