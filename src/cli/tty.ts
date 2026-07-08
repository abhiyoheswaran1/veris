import { detectCI } from "../util/env.js";

export function isPlain(): boolean {
  return detectCI() || !process.stdout.isTTY;
}
