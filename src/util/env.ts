import { platform } from "node:os";
import type { EnvironmentInfo } from "../core/model.js";

export function detectCI(): boolean {
  return process.env.CI === "true" || process.env.CI === "1";
}

export function getEnvironmentInfo(pm: string): EnvironmentInfo {
  return {
    os: platform(),
    node: process.version,
    pm,
    ci: detectCI(),
    timestamp: new Date().toISOString(),
  };
}
