import pc from "picocolors";
import { detectProject } from "../../config/detect.js";
import type { EnvironmentInfo, Project } from "../../core/model.js";
import { getEnvironmentInfo } from "../../util/env.js";
import { isPlain } from "../tty.js";

export function renderDoctor(project: Project, env: EnvironmentInfo): string {
  const plain = isPlain();
  const ok = (s: string) => (plain ? s : pc.green(s));
  const dim = (s: string) => (plain ? s : pc.dim(s));
  const lines: string[] = [];
  lines.push("VerisKit doctor");
  lines.push("");
  lines.push(`Package manager  ${project.packageManager}`);
  lines.push(`Node             ${env.node}`);
  lines.push(`Languages        ${project.languages.join(", ")}`);
  if (project.frameworks.length)
    lines.push(`Frameworks       ${project.frameworks.join(", ")}`);
  lines.push("");
  lines.push("Capabilities");
  for (const c of project.capabilities) {
    const label = `${c.id} (${c.language})`;
    if (c.available) {
      lines.push(`  ${ok("✓")} ${label.padEnd(16)} ${dim(`via ${c.runner}`)}`);
    } else {
      lines.push(
        `  ${dim("⊘")} ${label.padEnd(16)} ${dim(`skipped — ${c.reason}`)}`,
      );
    }
  }
  return lines.join("\n");
}

export async function runDoctor(root: string): Promise<number> {
  const project = await detectProject(root);
  const env = getEnvironmentInfo(project.packageManager);
  process.stdout.write(`${renderDoctor(project, env)}\n`);
  return 0;
}
