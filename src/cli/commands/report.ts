import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function runReport(root: string): Promise<number> {
  const dir = join(root, ".veris", "reports");
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    process.stdout.write("No reports yet. Run `veris verify` first.\n");
    return 0;
  }
  const latest = files.at(-1);
  if (!latest) {
    process.stdout.write("No reports yet. Run `veris verify` first.\n");
    return 0;
  }
  process.stdout.write(`${readFileSync(join(dir, latest), "utf8")}\n`);
  return 0;
}
