import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeIfAbsent(
  path: string,
  content: string,
): Promise<boolean> {
  if (existsSync(path)) return false;
  await writeFile(path, content, "utf8");
  return true;
}

export async function readJsonIfExists<T = unknown>(
  path: string,
): Promise<T | null> {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}
