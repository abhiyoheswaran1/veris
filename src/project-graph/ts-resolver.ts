import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
// type-only namespace import — erased at build, so `typescript` NEVER enters
// the runtime bundle; the real module is loaded dynamically from the project.
import type * as ts from "typescript";
import { toPosix } from "./discover.js";
import { scannerImports } from "./scanner-resolver.js";

export interface ResolverChoice {
  resolver: "typescript" | "scanner";
  importsOf: (file: string) => string[];
}

export function loadTypeScript(root: string): typeof ts | null {
  try {
    const require = createRequire(join(root, "__veris__.js"));
    // resolve the project's own typescript; require it (typescript is CJS)
    const tsPath = require.resolve("typescript");
    return require(tsPath) as typeof ts;
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
      resolved.startsWith(root)
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
    const options = loadCompilerOptions(tsmod, root);
    return {
      resolver: "typescript",
      importsOf: (file) => tsImports(tsmod, root, options, file),
    };
  }
  return {
    resolver: "scanner",
    importsOf: (file) => scannerImports(root, file),
  };
}
