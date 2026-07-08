import { join } from "node:path";
import type { CapabilityId } from "../core/model.js";
import { readJsonIfExists } from "../util/fs-safe.js";

export interface VerisConfig {
  checks?: CapabilityId[];
}

export async function loadConfig(root: string): Promise<VerisConfig | null> {
  return readJsonIfExists<VerisConfig>(join(root, ".veris", "config.json"));
}
