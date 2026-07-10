import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { toPosix } from "./discover.js";

const EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const SPEC_RE =
  /(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|[^.\w])import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

export function extractSpecifiers(text: string): string[] {
  const specs: string[] = [];
  SPEC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  m = SPEC_RE.exec(text);
  while (m !== null) {
    const s = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (s) specs.push(s);
    m = SPEC_RE.exec(text);
  }
  return specs;
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolveRelative(fromDir: string, spec: string): string | null {
  const base = resolve(fromDir, spec);
  const candidates: string[] = [base];
  for (const ext of EXTS) candidates.push(base + ext);
  // ESM "./x.js" pointing at a TypeScript source: rewrite the extension
  const extMatch = base.match(/\.[cm]?[jt]sx?$/);
  if (extMatch) {
    const noExt = base.slice(0, -extMatch[0].length);
    for (const ext of EXTS) candidates.push(noExt + ext);
  }
  for (const ext of EXTS) candidates.push(join(base, `index${ext}`));
  for (const c of candidates) {
    if (existsSync(c) && isFile(c)) return c;
  }
  return null;
}

export function scannerImports(root: string, file: string): string[] {
  let text: string;
  try {
    text = readFileSync(join(root, file), "utf8");
  } catch {
    return [];
  }
  const dir = dirname(join(root, file));
  const out = new Set<string>();
  for (const spec of extractSpecifiers(text)) {
    if (!spec.startsWith(".")) continue; // relative specifiers only
    const resolved = resolveRelative(dir, spec);
    if (resolved) out.add(toPosix(relative(root, resolved)));
  }
  return [...out];
}
