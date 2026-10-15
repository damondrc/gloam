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
 */
import { en } from "./i18n/en";
import type { Messages } from "./i18n/en";

export type { Messages };

/** The languages there are dictionaries for. */
export type Locale = "en";

const DICTIONARIES: Record<Locale, Messages> = { en };

class Language {
  locale = $state<Locale>("en");
  messages = $derived(DICTIONARIES[this.locale]);
}

export const language = new Language();
