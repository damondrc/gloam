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
 * What is stored is a preference, not a language: "system", or one language
 * chosen in Settings. Somebody who never opens Settings keeps following the
 * system, including after the system changes, which would stop being true the
 * moment the language it happened to resolve to was written down instead.
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

/** What can be chosen in Settings: follow the system, or one language. */
export type LanguagePreference = "system" | Locale;

/**
 * In the order Settings cycles through them. Built from the dictionaries, so
 * a new language becomes choosable the moment it has one.
 */
export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = [
  "system",
  ...(Object.keys(DICTIONARIES) as Locale[]),
];

/**
 * Each language's name in itself, the same in every dictionary.
 *
 * Kept out of the dictionaries on purpose. Somebody who has ended up in a
 * language they cannot read has to be able to find their own in the list,
 * and "Spanish" written in Japanese does not help a Spanish speaker. Keyed by
 * every locale, so a new language does not compile until it has named itself.
 */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function resolveLocale(
  preference: LanguagePreference,
  preferred: readonly string[]
): Locale {
  return preference === "system" ? pickLocale(preferred) : preference;
}

class Language {
  preference = $state<LanguagePreference>("system");
  /** What the system alone would pick, for Settings to say out loud. */
  system = pickLocale(systemLanguages());
  locale = $derived(resolveLocale(this.preference, systemLanguages()));
  messages = $derived(DICTIONARIES[this.locale]);
}

export const language = new Language();
