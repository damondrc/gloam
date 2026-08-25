/**
 * The timer's pure logic: data in, data out.
 *
 * Kept apart from `timer.svelte.ts` on purpose. That file holds reactive state
 * and needs the Svelte compiler to run at all; this one is ordinary
 * TypeScript, which means the tests next to it need no browser, no component
 * harness and no compiler — they call a function and check the answer.
 *
 * The split follows the general rule: logic worth testing should not be
 * welded to the machinery that makes it hard to test.
 */

export type Phase = "focus" | "break";

export interface Segment {
  phase: Phase;
  durationMs: number;
}

export interface TimerConfig {
  focusMinutes: number;
  breakMinutes: number;
  /** How many focus sessions make up one full run. */
  focusSessions: number;
}

export const DEFAULT_CONFIG: TimerConfig = {
  focusMinutes: 30,
  breakMinutes: 10,
  focusSessions: 2,
};

/**
 * What each setting is allowed to be.
 *
 * Declared here rather than in the panel so the controls, the validation
 * applied to stored preferences and the tests all read the same numbers.
 * Ranges that disagree between the widget and its storage are the kind of bug
 * that only shows up after a restart.
 */
export const LIMITS = {
  focusMinutes: { min: 5, max: 90, step: 5 },
  breakMinutes: { min: 1, max: 30, step: 1 },
  focusSessions: { min: 1, max: 8, step: 1 },
} as const;

export type SettingKey = keyof typeof LIMITS;

/**
 * Snaps a value into range and onto the setting's step.
 *
 * `floor` is an optional extra stop below the range, and it is matched
 * exactly rather than snapped to. That is the whole difference between an
 * extra stop and a wider range: a stored 1 is a stored 1 and still comes back
 * as the real minimum, whether or not the build reading it happens to also
 * offer half a minute. Only a value that is exactly the stop is the stop.
 *
 * Nothing in the app passes one in a release build — see `dev.ts` — so this
 * argument is how a stored test duration stops being legal the moment it is
 * read by a shipped Gloam.
 */
export function clampSetting(
  key: SettingKey,
  value: number,
  floor?: number
): number {
  const { min, max, step } = LIMITS[key];
  if (!Number.isFinite(value)) return DEFAULT_CONFIG[key];
  if (floor !== undefined && floor < min && value === floor) return floor;
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

const MS_PER_MINUTE = 60_000;

/**
 * Clamps to a floor, treating anything that is not a real number as absent.
 *
 * `Math.max(1, NaN)` is `NaN`, not 1 — so the obvious guard silently lets a
 * blank input through and produces a plan with no segments in it. An empty
 * field is exactly what a settings panel hands over mid-keystroke, which makes
 * this the likeliest input rather than an exotic one.
 */
function atLeast(value: number, floor: number): number {
  return Number.isFinite(value) ? Math.max(floor, value) : floor;
}

/**
 * Expands a config into the flat list of segments to run, in order.
 *
 * Breaks are placed *between* focus sessions and never after the last one: a
 * trailing break has nothing to resume into, so it is dead time.
 *
 * The session count is clamped to at least one whole session. The settings
 * panel lets a field be briefly empty or nonsensical while it is being typed
 * into, and the engine's job is to be unbreakable by whatever arrives — not to
 * assume the caller already cleaned up.
 *
 * Durations are minutes and nothing here requires them to be whole ones, which
 * is what lets the half-minute stop in `dev.ts` work without a special case:
 * 0.5 is thirty thousand milliseconds by the same multiplication as every
 * other value.
 */
export function buildPlan(config: TimerConfig): Segment[] {
  const sessions = atLeast(Math.floor(config.focusSessions), 1);
  const focusMs = atLeast(config.focusMinutes, 0) * MS_PER_MINUTE;
  const breakMs = atLeast(config.breakMinutes, 0) * MS_PER_MINUTE;

  const plan: Segment[] = [];
  for (let i = 0; i < sessions; i++) {
    if (i > 0) plan.push({ phase: "break", durationMs: breakMs });
    plan.push({ phase: "focus", durationMs: focusMs });
  }
  return plan;
}

/**
 * Renders remaining milliseconds as mm:ss.
 *
 * Rounds up, so the display never reads 00:00 while the segment is still
 * running — a clock that shows zero and keeps going reads as broken.
 */
export function formatDuration(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
