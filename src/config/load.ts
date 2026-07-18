import { join } from "node:path";
import type { CapabilityId, Language } from "../core/model.js";
import { readJsonIfExists } from "../util/fs-safe.js";

export interface VerisConfig {
  checks?: CapabilityId[];
  languages?: Partial<Record<Language, boolean>>;
  tools?: Partial<Record<Language, Partial<Record<CapabilityId, string>>>>;
}

export async function loadConfig(root: string): Promise<VerisConfig | null> {
  return readJsonIfExists<VerisConfig>(join(root, ".veris", "config.json"));
}
