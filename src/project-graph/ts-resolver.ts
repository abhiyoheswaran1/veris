import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
// type-only namespace import — erased at build, so `typescript` NEVER enters
// the runtime bundle; the real module is loaded dynamically from the project.
import type * as ts from "typescript";
import { toPosix } from "./discover.js";
import { scannerImports } from "./scanner-resolver.js";

export interface ResolverChoice {
  resolver: "typescript" | "scanner";
  importsOf: (file: string) => string[];
}

// A TS 7.x native (Go-ported) package loads fine but has none of the classic
// JS compiler API — preProcessFile/resolveModuleName/readConfigFile/sys are
// all absent. Guard against that so we degrade to the scanner instead of
// crashing with an uncaught TypeError deep in loadCompilerOptions/tsImports.
export function hasClassicApi(mod: unknown): mod is typeof ts {
  const m = mod as Record<string, unknown> | null;
  return (
    !!m &&
    typeof m.preProcessFile === "function" &&
    typeof m.resolveModuleName === "function" &&
    typeof m.readConfigFile === "function" &&
    typeof m.parseJsonConfigFileContent === "function" &&
    typeof m.sys === "object" &&
    m.sys !== null
  );
}

export function loadTypeScript(root: string): typeof ts | null {
  try {
    const require = createRequire(join(root, "__veris__.js"));
    // resolve the project's own typescript; require it (typescript is CJS)
    const tsPath = require.resolve("typescript");
    const mod = require(tsPath) as unknown;
    return hasClassicApi(mod) ? mod : null; // 7.x native package → null → scanner
  } catch {
    return null;
  }
}

export function loadCompilerOptions(
  tsmod: typeof ts,
  root: string,
): ts.CompilerOptions {
  const configPath = join(root, "tsconfig.json");
  const read = tsmod.readConfigFile(configPath, tsmod.sys.readFile);
  if (read.error || !read.config) return {};
  const parsed = tsmod.parseJsonConfigFileContent(read.config, tsmod.sys, root);
  return parsed.options;
}

export function tsImports(
  tsmod: typeof ts,
  root: string,
  options: ts.CompilerOptions,
  file: string,
): string[] {
  let text: string;
  try {
    text = readFileSync(join(root, file), "utf8");
  } catch {
    return [];
  }
  const abs = join(root, file);
  const pre = tsmod.preProcessFile(text, true, true);
  const out = new Set<string>();
  for (const imp of pre.importedFiles) {
    const res = tsmod.resolveModuleName(imp.fileName, abs, options, tsmod.sys);
    const resolved = res.resolvedModule?.resolvedFileName;
    if (
      resolved &&
      !resolved.includes("node_modules") &&
      resolved.startsWith(root + sep)
    ) {
      out.add(toPosix(relative(root, resolved)));
    }
  }
  return [...out];
}

export function selectResolver(root: string): ResolverChoice {
  const tsmod = existsSync(join(root, "tsconfig.json"))
    ? loadTypeScript(root)
    : null;
  if (tsmod) {
    try {
      const options = loadCompilerOptions(tsmod, root);
      return {
        resolver: "typescript",
        importsOf: (file) => tsImports(tsmod, root, options, file),
      };
    } catch {
      // any failure loading config/setting up the TS resolver degrades to
      // the scanner rather than propagating and crashing the command.
    }
  }
  return {
    resolver: "scanner",
    importsOf: (file) => scannerImports(root, file),
  };
}
