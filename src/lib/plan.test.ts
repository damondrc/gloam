import { describe, expect, it } from "vitest";
import { buildPlan, clampSetting, DEFAULT_CONFIG, formatDuration, LIMITS } from "./plan";
import type { SettingKey, TimerConfig } from "./plan";

const config = (focusSessions: number): TimerConfig => ({
  focusMinutes: 25,
  breakMinutes: 5,
  focusSessions,
});

describe("buildPlan", () => {
  // Runs against a spread of session counts rather than one, because the rule
  // being checked is "always", not "in this example".
  const counts = [1, 2, 3, 5, 12];

  it.each(counts)("alternates and never puts a break at either end (%i)", (n) => {
    const phases = buildPlan(config(n)).map((segment) => segment.phase);

    expect(phases.at(0)).toBe("focus");
    expect(phases.at(-1)).toBe("focus");
    expect(phases.every((p, i) => p === (i % 2 === 0 ? "focus" : "break"))).toBe(
      true
    );
  });

  it.each(counts)("has one break fewer than it has sessions (%i)", (n) => {
    const phases = buildPlan(config(n)).map((segment) => segment.phase);

    expect(phases.filter((p) => p === "focus")).toHaveLength(n);
    expect(phases.filter((p) => p === "break")).toHaveLength(n - 1);
  });

  it("gives a single session no break at all", () => {
    expect(buildPlan(config(1))).toEqual([
      { phase: "focus", durationMs: 25 * 60_000 },
    ]);
  });

  it("converts minutes to milliseconds", () => {
    const plan = buildPlan({
      focusMinutes: 30,
      breakMinutes: 10,
      focusSessions: 2,
    });

    expect(plan.map((s) => s.durationMs)).toEqual([1_800_000, 600_000, 1_800_000]);
  });

  // What the settings panel will actually hand over on a half-typed field.
  it.each([0, -4, 0.9, Number.NaN])(
    "falls back to one whole session for %p",
    (focusSessions) => {
      const plan = buildPlan(config(focusSessions));

      expect(plan).toHaveLength(1);
      expect(plan[0].phase).toBe("focus");
    }
  );

  it.each([
    { focusMinutes: -30, breakMinutes: -10 },
    { focusMinutes: Number.NaN, breakMinutes: Number.NaN },
  ])("never builds a segment of nonsensical length (%o)", (durations) => {
    const plan = buildPlan({ ...durations, focusSessions: 2 });

    expect(plan).toHaveLength(3);
    expect(plan.every((s) => Number.isFinite(s.durationMs) && s.durationMs >= 0))
      .toBe(true);
  });
});

describe("clampSetting", () => {
  const keys = Object.keys(LIMITS) as SettingKey[];

  it.each(keys)("keeps %s inside its own range", (key) => {
    const { min, max } = LIMITS[key];

    expect(clampSetting(key, min - 1000)).toBe(min);
    expect(clampSetting(key, max + 1000)).toBe(max);
  });

  it.each(keys)("snaps %s onto its step", (key) => {
    const { min, step } = LIMITS[key];
    const offGrid = min + step * 1.5;

    expect(clampSetting(key, offGrid) % step).toBe(0);
  });

  // Stored preferences can be hand-edited or left over from an older build.
  it.each(keys)("falls back to the default for a non-number %s", (key) => {
    expect(clampSetting(key, Number.NaN)).toBe(DEFAULT_CONFIG[key]);
  });

  // A default outside its own limits would show the panel a value its buttons
  // could never produce.
  it.each(keys)("ships a default that its own limits allow (%s)", (key) => {
    expect(clampSetting(key, DEFAULT_CONFIG[key])).toBe(DEFAULT_CONFIG[key]);
  });

  /**
   * The extra stop a test build offers below the range — see `dev.ts`.
   *
   * The behaviour worth pinning is not that half a minute is allowed. It is
   * that allowing it changes nothing else: a stop is one exact value, not a
   * lower minimum, and it only exists for whoever passes it in.
   */
  describe("an extra stop below the range", () => {
    const STOP = 0.5;

    it("keeps a value that is exactly the stop", () => {
      expect(clampSetting("focusMinutes", STOP, STOP)).toBe(STOP);
      expect(clampSetting("breakMinutes", STOP, STOP)).toBe(STOP);
    });

    // The stop is not a widened range. Everything between it and the minimum
    // is as illegal as it was before, so a hand-edited 1 is still a 1 that
    // never happened.
    it("still sends everything else below the minimum up to it", () => {
      const { min } = LIMITS.focusMinutes;

      expect(clampSetting("focusMinutes", 1, STOP)).toBe(min);
      expect(clampSetting("focusMinutes", 0, STOP)).toBe(min);
      expect(clampSetting("focusMinutes", -4, STOP)).toBe(min);
      expect(clampSetting("focusMinutes", min - 0.5, STOP)).toBe(min);
    });

    /**
     * The one that matters most. A release build passes no stop, so a duration
     * left behind in localStorage by a test build stops being a legal value
     * the first time a shipped Gloam reads its preferences — nothing has to
     * remember to clean it up.
     */
    it.each(keys)("is not legal for %s when nobody offers one", (key) => {
      expect(clampSetting(key, STOP)).toBe(LIMITS[key].min);
    });

    it("ignores a stop that is not actually below the range", () => {
      const { min } = LIMITS.focusMinutes;

      expect(clampSetting("focusMinutes", min, min)).toBe(min);
      expect(clampSetting("focusMinutes", min + 1, min + 1)).toBe(min);
    });

    // Which is the whole point of it: a segment you can watch end.
    it("is thirty seconds of an actual plan", () => {
      const plan = buildPlan({
        focusMinutes: STOP,
        breakMinutes: STOP,
        focusSessions: 2,
      });

      expect(plan.map((segment) => segment.durationMs)).toEqual([
        30_000, 30_000, 30_000,
      ]);
      expect(formatDuration(plan[0].durationMs)).toBe("00:30");
    });
  });
});

describe("formatDuration", () => {
  it("pads both fields to two digits", () => {
    expect(formatDuration(9_000)).toBe("00:09");
    expect(formatDuration(65_000)).toBe("01:05");
  });

  // A clock reading 00:00 while the segment is still running looks broken, so
  // the last fractional second is rounded up rather than down.
  it("rounds up so it never reads zero while time remains", () => {
    expect(formatDuration(1)).toBe("00:01");
    expect(formatDuration(999)).toBe("00:01");
    expect(formatDuration(0)).toBe("00:00");
  });

  it("never renders a negative time", () => {
    expect(formatDuration(-5_000)).toBe("00:00");
  });

  it("keeps counting past an hour rather than wrapping", () => {
    expect(formatDuration(90 * 60_000)).toBe("90:00");
  });
});
