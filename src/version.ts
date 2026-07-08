import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkgUrl = new URL("../package.json", import.meta.url);
export const VERSION: string = JSON.parse(
  readFileSync(fileURLToPath(pkgUrl), "utf8"),
).version;
