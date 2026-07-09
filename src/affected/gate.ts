import type { CapabilityId, Project } from "../core/model.js";

export interface AffectedPlan {
  checks: CapabilityId[];
  reasonByCheck: Partial<Record<CapabilityId, string>>;
  changedCount: number;
}

const ORDER: CapabilityId[] = ["types", "lint", "unit", "browser"];

const CONFIG_RE =
  /(^|\/)(tsconfig[^/]*\.json|biome\.jsonc?|\.eslintrc[^/]*|eslint\.config\.[^/]+|package\.json|veris\.config\.[^/]+)$/;
const TEST_RE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(test|__tests__)\//;
const TS_RE = /\.[cm]?tsx?$/;
const JS_RE = /\.[cm]?jsx?$/;
const DOC_RE =
  /(\.(md|mdx|markdown|txt|png|jpe?g|gif|svg|webp|ico)$)|((^|\/)LICENSE$)/i;

export function affectedChecks(
  files: string[],
  project: Project,
): AffectedPlan {
  const available = new Set(
    project.capabilities.filter((c) => c.available).map((c) => c.id),
  );
  const wanted = new Set<CapabilityId>();
  const reasonByCheck: Partial<Record<CapabilityId, string>> = {};
  const want = (id: CapabilityId, reason: string): void => {
    if (available.has(id) && !wanted.has(id)) {
      wanted.add(id);
      reasonByCheck[id] = reason;
    }
  };
  const wantAll = (reason: string): void => {
    for (const id of available) want(id, reason);
  };

  for (const f of files) {
    if (CONFIG_RE.test(f)) {
      wantAll(`config changed (${f})`);
    } else if (DOC_RE.test(f)) {
      // docs/assets affect nothing
    } else if (TEST_RE.test(f)) {
      want("unit", "test file changed");
      want("lint", "test file changed");
    } else if (TS_RE.test(f)) {
      want("types", "TypeScript changed");
      want("lint", "TypeScript changed");
      want("unit", "TypeScript changed");
    } else if (JS_RE.test(f)) {
      want("lint", "JavaScript changed");
      want("unit", "JavaScript changed");
    } else {
      wantAll(`unrecognized file changed (${f})`);
    }
  }

  return {
    checks: ORDER.filter((id) => wanted.has(id)),
    reasonByCheck,
    changedCount: files.length,
  };
}
