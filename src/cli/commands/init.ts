import { join } from "node:path";
import { detectProject } from "../../config/detect.js";
import { ensureDir, writeIfAbsent } from "../../util/fs-safe.js";

const GITIGNORE = ["runs/", "reports/", "cache/", "graph.json", ""].join("\n");

export async function runInit(root: string): Promise<number> {
  const project = await detectProject(root);
  const dir = join(root, ".veris");
  await ensureDir(dir);

  const defaultChecks = project.capabilities
    .filter((c) => c.available && c.id !== "browser")
    .map((c) => c.id);

  const wroteConfig = await writeIfAbsent(
    join(dir, "config.json"),
    `${JSON.stringify({ checks: defaultChecks }, null, 2)}\n`,
  );
  await writeIfAbsent(join(dir, ".gitignore"), GITIGNORE);

  process.stdout.write(
    wroteConfig
      ? `Veris initialized. Detected checks: ${defaultChecks.join(", ") || "none"}.\n`
      : "VerisKit already initialized (.veris/config.json exists). Nothing overwritten.\n",
  );
  return 0;
}
