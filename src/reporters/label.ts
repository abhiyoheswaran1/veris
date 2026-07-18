import { type CheckResult, splitKey } from "../core/model.js";

// True when the results span more than one language, so a per-row language
// qualifier is worth showing. A single-language run stays unqualified.
export function runSpansLanguages(results: CheckResult[]): boolean {
  const langs = new Set(results.map((r) => splitKey(r.checkId).language));
  return langs.size > 1;
}

// Display label for a check row: the bare capability id ("unit") for a
// single-language run, or the language-qualified form ("unit (python)") when
// the run spans multiple languages.
export function checkLabel(checkId: string, showLanguage: boolean): string {
  const { id, language } = splitKey(checkId);
  return showLanguage ? `${id} (${language})` : id;
}
