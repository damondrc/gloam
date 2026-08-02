import { describe, expect, it } from "vitest";
import { buildPlan, formatDuration } from "./plan";
import type { TimerConfig } from "./plan";

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
