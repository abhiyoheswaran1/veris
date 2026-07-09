import {
  type FSWatcher,
  watch as fsWatch,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, join, relative } from "node:path";

export interface WatchOptions {
  poll?: boolean;
  debounceMs?: number;
  pollIntervalMs?: number;
}

const IGNORE =
  /(^|\/)(\.git|\.veris|\.agentloop|\.agentflight|node_modules|dist)(\/|$)/;

export function watch(
  root: string,
  opts: WatchOptions,
  onBatch: (changedPaths: string[]) => void,
): () => void {
  const debounceMs = opts.debounceMs ?? 150;
  // On some platforms (notably macOS FSEvents), recursive fs.watch can emit a
  // spurious self-referential event for the root directory itself — reported
  // with a "filename" equal to root's own basename — right after the watch is
  // established, especially if root was just created. That isn't a change to
  // any file under root, so it's filtered out alongside the ignored dirs.
  const rootBase = basename(root);
  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    const batch = [...pending];
    pending = new Set();
    timer = null;
    if (batch.length) onBatch(batch);
  };
  const schedule = (rel: string): void => {
    if (!rel || rel === rootBase || IGNORE.test(rel)) return;
    pending.add(rel);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  if (opts.poll) {
    const interval = opts.pollIntervalMs ?? 400;
    const mtimes = scanMtimes(root);
    const tick = setInterval(() => {
      const next = scanMtimes(root);
      for (const [p, m] of next) {
        if (mtimes.get(p) !== m) schedule(p);
      }
      mtimes.clear();
      for (const [p, m] of next) mtimes.set(p, m);
    }, interval);
    return () => {
      clearInterval(tick);
      if (timer) clearTimeout(timer);
    };
  }

  let watcher: FSWatcher;
  try {
    watcher = fsWatch(root, { recursive: true }, (_event, filename) => {
      if (filename) schedule(filename.toString());
    });
  } catch {
    // recursive not supported here — caller should retry with { poll: true }
    throw new Error(
      "recursive fs.watch is unavailable on this platform; rerun with --poll",
    );
  }
  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}

function scanMtimes(root: string): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const abs = join(dir, name);
      const rel = relative(root, abs);
      if (IGNORE.test(rel)) continue;
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(abs);
      else out.set(rel, st.mtimeMs);
    }
  };
  walk(root);
  return out;
}
