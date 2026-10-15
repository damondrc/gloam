import { describe, expect, it } from "vitest";
import { en } from "./i18n/en";
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

describe("the English dictionary", () => {
  // The compiler already guarantees every language has the same lines. What
  // it cannot see is a line that is there and says nothing.
  it.each(leaves(en))("says something at %s", (_path, value) => {
    if (typeof value === "function") {
      // Called with a plausible argument of each kind it might take.
      const said = (value as (...args: unknown[]) => unknown)(2, 4);
      expect(typeof said).toBe("string");
      expect((said as string).trim().length).toBeGreaterThan(0);
      return;
    }

    expect(typeof value).toBe("string");
    expect((value as string).trim().length).toBeGreaterThan(0);
  });

  // The one sentence with a plural in it, which is also the one most likely to
  // be got wrong by a language whose plural works differently.
  it("counts tracks in the singular and the plural", () => {
    expect(en.panel.tracks(1)).toBe("1 track");
    expect(en.panel.tracks(0)).toBe("0 tracks");
    expect(en.panel.tracks(34)).toBe("34 tracks");
  });

  // The tour's order lives in tour.ts and its words in the dictionary; a step
  // with no sentence, or a sentence no step uses, is one of the two having
  // moved without the other.
  it("has a sentence for every step of the tour, and no others", () => {
    const steps = TOUR.map((step) => step.id);

    expect([...steps].sort()).toEqual(Object.keys(en.tour.steps).sort());
  });
});
