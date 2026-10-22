import { describe, expect, it } from "vitest";
import { DICTIONARIES, pickLocale, type Locale, type Messages } from "./i18n.svelte";
import { TOUR } from "./tour";

/**
 * Every leaf of a dictionary, as a path and a value, so a test can say which
 * line is wrong rather than only that one is.
 */
function leaves(node: unknown, path = ""): [string, unknown][] {
  if (typeof node === "object" && node !== null) {
    return Object.entries(node).flatMap(([key, value]) =>
      leaves(value, path ? `${path}.${key}` : key)
    );
  }
  return [[path, node]];
}

/**
 * What each sentence with something inside it is called with here.
 *
 * Written out rather than guessed, because a guess has to fit every kind of
 * argument at once: the controls take a name, and a language that does
 * something with that name — Spanish lowers its case — throws when handed a
 * number instead. The names come from the dictionary under test, so each
 * language is checked with its own words.
 */
const ARGUMENTS: Record<string, (m: Messages) => unknown[]> = {
  "widget.sessionOf": () => [2, 4],
  "controls.previousOf": (m) => [m.panel.sound],
  "controls.nextOf": (m) => [m.panel.sound],
  "controls.decrease": (m) => [m.panel.focus],
  "controls.increase": (m) => [m.panel.focus],
  "tour.stepOf": () => [2, 4],
  "panel.tracks": () => [34],
};

/**
 * The one sentence with a plural in it, which is also the one most likely to
 * be got wrong by a language whose plural works differently. Keyed by every
 * locale, so a new language does not compile until somebody has said how it
 * counts.
 */
const TRACKS: Record<Locale, [number, string][]> = {
  en: [
    [1, "1 track"],
    [0, "0 tracks"],
    [34, "34 tracks"],
  ],
  es: [
    [1, "1 pista"],
    [0, "0 pistas"],
    [34, "34 pistas"],
  ],
};

const LOCALES = Object.keys(DICTIONARIES) as Locale[];

describe.each(LOCALES)("the %s dictionary", (locale) => {
  const messages = DICTIONARIES[locale];

  // The compiler already guarantees every language has the same lines. What
  // it cannot see is a line that is there and says nothing.
  it.each(leaves(messages))("says something at %s", (path, value) => {
    if (typeof value === "function") {
      const args = ARGUMENTS[path];
      expect(args, `no arguments written down for ${path}`).toBeDefined();
      const said = (value as (...a: unknown[]) => unknown)(...args(messages));
      expect(typeof said).toBe("string");
      expect((said as string).trim().length).toBeGreaterThan(0);
      return;
    }

    expect(typeof value).toBe("string");
    expect((value as string).trim().length).toBeGreaterThan(0);
  });

  it("counts tracks in the singular and the plural", () => {
    for (const [count, said] of TRACKS[locale]) {
      expect(messages.panel.tracks(count)).toBe(said);
    }
  });

  // The tour's order lives in tour.ts and its words in the dictionary; a step
  // with no sentence, or a sentence no step uses, is one of the two having
  // moved without the other.
  it("has a sentence for every step of the tour, and no others", () => {
    const steps = TOUR.map((step) => step.id);

    expect([...steps].sort()).toEqual(Object.keys(messages.tour.steps).sort());
  });
});

describe("the language Gloam starts in", () => {
  it.each(LOCALES)("is %s for a system that prefers it", (locale) => {
    expect(pickLocale([locale])).toBe(locale);
  });

  // Gloam has one Spanish. The region says where somebody is, not which of
  // the dictionaries they can read.
  it.each(["es", "es-MX", "es-419", "es-ES", "ES-mx", "es_MX.UTF-8"])(
    "is Spanish for %s",
    (tag) => {
      expect(pickLocale([tag])).toBe("es");
    }
  );

  it("is the first preference there is a dictionary for", () => {
    expect(pickLocale(["de-DE", "es-AR", "en-US"])).toBe("es");
    expect(pickLocale(["en-GB", "es"])).toBe("en");
    expect(pickLocale(["fr", "de", "en-US", "es"])).toBe("en");
  });

  it("is English when nothing matches, or nothing is said", () => {
    expect(pickLocale(["de-DE", "fr-FR"])).toBe("en");
    expect(pickLocale([])).toBe("en");
    expect(pickLocale([""])).toBe("en");
  });

  // A dictionary table is an object, and objects answer to names nobody put
  // in them.
  it("is not fooled by what every object has", () => {
    expect(pickLocale(["constructor", "toString", "__proto__"])).toBe("en");
  });
});
