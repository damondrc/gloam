import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "./prefs";
import type { Prefs } from "./prefs";
import { DEFAULT_CONFIG, LIMITS } from "./plan";
import { MAX_SCALE, MIN_SCALE } from "./scale.svelte";

/**
 * Stored preferences are the only untrusted input Gloam has.
 *
 * They can be hand-edited, left over from a build with different limits, or
 * simply corrupt, and every one of those arrives at startup — which is the
 * worst possible moment for something to throw. Nothing in here is about
 * whether a preference is convenient. It is all about the widget opening.
 *
 * The key is written out rather than imported: changing it silently orphans
 * everybody's settings, so it should take a failing test to do it.
 */
const KEY = "gloam.prefs.v1";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

const write = (value: unknown): void => {
  store.set(KEY, typeof value === "string" ? value : JSON.stringify(value));
};

describe("with nothing stored", () => {
  it("returns the defaults", () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  // A default the controls could never produce would show the panel a value
  // it cannot get back to.
  it("ships defaults its own limits allow", () => {
    const { scale, volume, config } = DEFAULT_PREFS;

    expect(scale).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(scale).toBeLessThanOrEqual(MAX_SCALE);
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe("round trip", () => {
  const written: Prefs[] = [
    DEFAULT_PREFS,
    {
      compact: true,
      scale: 1.35,
      volume: 0,
      sound: "bell",
      ambience: "light",
      horizon: "skyline",
      config: { focusMinutes: 45, breakMinutes: 15, focusSessions: 4 },
      position: { x: 2400, y: 300 },
      seenIntro: true,
    },
    {
      compact: false,
      scale: MIN_SCALE,
      volume: 1,
      sound: "felt",
      ambience: "calm",
      horizon: "ridge",
      config: { focusMinutes: 5, breakMinutes: 1, focusSessions: 1 },
      position: { x: -1200, y: -80 },
      seenIntro: false,
    },
  ];

  it.each(written)("gives back exactly what it was given (%#)", (prefs) => {
    savePrefs(prefs);

    expect(loadPrefs()).toEqual(prefs);
  });
});

describe("nonsense in storage", () => {
  const garbage = [
    "not json at all",
    "{",
    '"a string"',
    "42",
    "null",
    "[]",
    '{"scale":"large","volume":"loud"}',
    '{"config":"none"}',
    '{"config":{"focusMinutes":null}}',
    '{"compact":"yes","ambience":42,"sound":[],"horizon":{}}',
  ];

  // The bar is not "recovers gracefully". It is "the widget opens", which
  // means every field is present and inside its range whatever was there.
  it.each(garbage)("still yields a complete, usable set from %s", (raw) => {
    write(raw);

    const prefs = loadPrefs();

    expect(Object.keys(prefs).sort()).toEqual(Object.keys(DEFAULT_PREFS).sort());
    expect(prefs.scale).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(prefs.scale).toBeLessThanOrEqual(MAX_SCALE);
    expect(prefs.volume).toBeGreaterThanOrEqual(0);
    expect(prefs.volume).toBeLessThanOrEqual(1);
    expect(typeof prefs.compact).toBe("boolean");
    expect(["bowl", "bell", "felt"]).toContain(prefs.sound);
    expect(["full", "calm", "light"]).toContain(prefs.ambience);
    expect(["water", "skyline", "ridge"]).toContain(prefs.horizon);
    expect(Number.isFinite(prefs.config.focusMinutes)).toBe(true);
  });

  it("survives storage that throws on read", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
    });

    expect(() => loadPrefs()).not.toThrow();
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  // Private browsing, a full quota, a locked-down profile. Forgetting is
  // acceptable; refusing to run is not.
  it("survives storage that throws on write", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });

    expect(() => savePrefs(DEFAULT_PREFS)).not.toThrow();
  });
});

describe("values out of range", () => {
  it.each([
    ["scale", MAX_SCALE + 5, MAX_SCALE],
    ["scale", MIN_SCALE - 5, MIN_SCALE],
    ["volume", 4, 1],
    ["volume", -4, 0],
  ] as const)("pulls %s back from %p to %p", (key, stored, expected) => {
    write({ [key]: stored });

    expect(loadPrefs()[key]).toBe(expected);
  });

  it.each(["focusMinutes", "breakMinutes", "focusSessions"] as const)(
    "clamps %s to the range the panel offers",
    (key) => {
      write({ config: { [key]: 10_000 } });
      expect(loadPrefs().config[key]).toBe(LIMITS[key].max);

      write({ config: { [key]: -10_000 } });
      expect(loadPrefs().config[key]).toBe(LIMITS[key].min);
    }
  );

  // An option from a newer build, or one that has since been removed.
  it.each([
    ["sound", "trombone"],
    ["ambience", "cinematic"],
    ["horizon", "desert"],
  ] as const)("falls back when %s is a value it does not offer", (key, stored) => {
    write({ [key]: stored });

    expect(loadPrefs()[key]).toBe(DEFAULT_PREFS[key]);
  });
});

describe("preferences written before the sound sets existed", () => {
  // Someone who went looking for the quietest alarm should not be handed a
  // louder one by an update, so the old timbre picks the nearest set.
  it.each([
    ["bowl", "bowl"],
    ["bell", "bell"],
    ["marimba", "felt"],
    ["pulse", "felt"],
  ] as const)("carries a %s alarm over to the %s set", (timbre, expected) => {
    write({ timbre, pattern: "echo", buttons: "drop" });

    expect(loadPrefs().sound).toBe(expected);
  });

  it("falls back for a timbre that never existed", () => {
    write({ timbre: "kazoo" });

    expect(loadPrefs().sound).toBe(DEFAULT_PREFS.sound);
  });

  it("prefers a set that has already been chosen over the old timbre", () => {
    write({ sound: "felt", timbre: "bell" });

    expect(loadPrefs().sound).toBe("felt");
  });

  it("leaves the rest of an old blob alone", () => {
    write({ timbre: "marimba", compact: true, scale: 1.2 });

    const prefs = loadPrefs();

    expect(prefs.compact).toBe(true);
    expect(prefs.scale).toBe(1.2);
  });
});

describe("the window position", () => {
  it("is absent until the window has been moved", () => {
    expect(loadPrefs().position).toBeNull();
  });

  // Negative coordinates are ordinary: a monitor above or to the left of the
  // primary one puts everything on it in negative space.
  it.each([
    { x: 48, y: 48 },
    { x: 2400, y: 300 },
    { x: -1600, y: -220 },
    { x: 0, y: 0 },
  ])("keeps %j", (position) => {
    write({ position });

    expect(loadPrefs().position).toEqual(position);
  });

  it("rounds a fractional pixel, which is not a place", () => {
    write({ position: { x: 48.6, y: 47.2 } });

    expect(loadPrefs().position).toEqual({ x: 49, y: 47 });
  });

  // Anything unusable becomes "no opinion", which is the safe answer: the
  // window simply opens where it would have opened anyway.
  it.each([
    ["a string", "48,48"],
    ["a number", 48],
    ["null", null],
    ["half a point", { x: 48 }],
    ["strings for coordinates", { x: "48", y: "48" }],
    ["not a number", { x: Number.NaN, y: 0 }],
    ["infinite", { x: Number.POSITIVE_INFINITY, y: 0 }],
    ["an array", [48, 48]],
  ])("discards %s", (_, position) => {
    write({ position });

    expect(loadPrefs().position).toBeNull();
  });
});

describe("the one-time hint", () => {
  it("has not been seen by someone opening Gloam for the first time", () => {
    expect(loadPrefs().seenIntro).toBe(false);
  });

  it("stays seen once it has been", () => {
    write({ seenIntro: true });

    expect(loadPrefs().seenIntro).toBe(true);
  });

  // Anything other than a literal true means it has not been seen. Showing a
  // hint twice is a small annoyance; never showing it at all defeats it, so
  // the doubt is resolved towards saying it.
  it.each([
    ["a string", "yes"],
    ["a number", 1],
    ["null", null],
    ["missing", undefined],
  ])("treats %s as not seen", (_, seenIntro) => {
    write({ seenIntro });

    expect(loadPrefs().seenIntro).toBe(false);
  });
});

describe("what is deliberately not remembered", () => {
  // Lock is a mode rather than a preference, and the one mode in which the
  // widget accepts almost no input. Booting into it turns any failure in the
  // click-through path into a window nobody can interact with.
  it("never writes a lock state, whatever it is handed", () => {
    savePrefs({ ...DEFAULT_PREFS, locked: true } as Prefs & { locked: boolean });

    expect(loadPrefs()).not.toHaveProperty("locked");
  });
});
