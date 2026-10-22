/**
 * Which language the interface speaks, as state the whole app can read.
 *
 * Deliberately not a library. What Gloam needs from one is a dictionary per
 * language, a way to pick between them, and a guarantee that every dictionary
 * covers every line — and the third is the part libraries do least well,
 * because they look strings up by key at run time and find out a key is
 * missing when somebody sees it. Here a dictionary is a typed object, so the
 * guarantee is the compiler's.
 *
 * Components read `language.messages` through a `$derived`, which makes every
 * word on screen follow a change of language without anything being reloaded.
 *
 * It starts in the system's language. Nothing is stored yet, so there is
 * nothing to disagree with: the first launch and every launch after it ask the
 * same question and get the same answer until the system changes.
 */
import { en } from "./i18n/en";
import type { Messages } from "./i18n/en";
import { es } from "./i18n/es";

export type { Messages };

/** The languages there are dictionaries for. */
export type Locale = "en" | "es";

export const DICTIONARIES: Record<Locale, Messages> = { en, es };

const isLocale = (tag: string): tag is Locale => Object.hasOwn(DICTIONARIES, tag);

/**
 * The language to speak, given the ones the system prefers, best first.
 *
 * Only the language is read, never the region: Gloam has one Spanish, and
 * somebody in Madrid is better served by it than by English. The first
 * language there is a dictionary for wins, so a system set to German with
 * Spanish as its second choice gets Spanish rather than falling straight
 * through to the default. Underscores are accepted as well as hyphens because
 * a POSIX locale such as `es_MX.UTF-8` is what the WebView on Linux is
 * working from, and it does not always tidy it up.
 *
 * English when nothing matches, because it is the language every line was
 * written in first.
 */
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const primary = tag.split(/[-_.]/)[0].toLowerCase();
    if (isLocale(primary)) return primary;
  }
  return "en";
}

/**
 * Asked of the WebView rather than of Rust. `navigator.languages` is the
 * system's own list on Windows, and on Linux WebKitGTK builds it from the
 * environment — which the platform checklist exists to confirm. Absent in the
 * test runner, where there is no browser to ask.
 */
const systemLanguages = (): readonly string[] =>
  typeof navigator === "undefined" ? [] : navigator.languages;

class Language {
  locale = $state<Locale>(pickLocale(systemLanguages()));
  messages = $derived(DICTIONARIES[this.locale]);
}

export const language = new Language();
