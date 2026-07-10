import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { NodeKind } from "./model.js";

const IGNORE =
  /(^|\/)(\.git|\.veris|\.agentloop|\.agentflight|node_modules|dist|coverage|build)(\/|$)/;
const CODE_RE = /\.[cm]?[jt]sx?$/;
const TEST_RE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(test|tests|__tests__)\//;
const CONFIG_RE = /(^|\/)([^/]+\.config\.[cm]?[jt]sx?)$/;

export interface DiscoveredFile {
  file: string;
  kind: NodeKind;
}

export function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

function classify(rel: string): NodeKind {
  if (TEST_RE.test(rel)) return "test";
  if (CONFIG_RE.test(rel)) return "config";
  return "source";
}

export function discoverFiles(root: string): DiscoveredFile[] {
  const out: DiscoveredFile[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const abs = join(dir, name);
      const rel = toPosix(relative(root, abs));
      if (IGNORE.test(rel)) continue;
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(abs);
      } else if (CODE_RE.test(rel)) {
        out.push({ file: rel, kind: classify(rel) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.file.localeCompare(b.file));
}
