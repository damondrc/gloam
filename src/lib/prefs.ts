/**
 * Preferences that should survive a restart.
 *
 * The durations moved here when the settings panel landed, which was the point
 * at which this was expected to become a JSON file managed by Rust. It has not,
 * on purpose: the reason to leave localStorage would be reliability, and that
 * is already handled below by treating whatever comes back as untrusted rather
 * than by trusting the store more. Moving would buy two Tauri commands, two
 * permissions, a file format and a migration path, none of which the user would
 * notice. If a reason ever appears, this is still the seam.
 */

import { clampSetting, DEFAULT_CONFIG } from "./plan";
import type { TimerConfig } from "./plan";
import { MAX_SCALE, MIN_SCALE } from "./scale.svelte";
import { SOUND_SETS } from "./sound";
import type { SoundSet } from "./sound";
import { AMBIENCE_MODES } from "./ambience";
import type { Ambience } from "./ambience";

const KEY = "gloam.prefs.v1";

/**
 * Lock is deliberately absent.
 *
 * It is a mode, not a preference, and it is the one mode in which the widget
 * accepts almost no input. Booting into it means that any failure in the
 * click-through path leaves the user with a window they cannot interact with
 * and no obvious way out. Compact and scale are safe to restore because a
 * wrong value there is merely ugly; a wrong value here is a trap.
 */
export interface Prefs {
  compact: boolean;
  scale: number;
  volume: number;
  sound: SoundSet;
  ambience: Ambience;
  config: TimerConfig;
  /**
   * Where the window was left, in physical desktop pixels, or null if it has
   * never been moved.
   *
   * Stored as a suggestion rather than an instruction: the monitor it refers
   * to may not be there next time, so it is checked before it is obeyed. See
   * `placement.ts`.
   */
  position: { x: number; y: number } | null;
}

export const DEFAULT_PREFS: Prefs = {
  compact: false,
  scale: 1,
  volume: 0.6,
  sound: "bowl",
  ambience: "full",
  config: { ...DEFAULT_CONFIG },
  position: null,
};

/**
 * A position is only worth keeping if it is two real numbers.
 *
 * Rounded on the way in, because a fractional physical pixel is not a place
 * and only ever arrives from a rounding error somewhere upstream.
 */
function readPosition(value: unknown): Prefs["position"] {
  if (typeof value !== "object" || value === null) return null;

  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * What an older Gloam stored, before the three sound settings became one.
 *
 * The alarm timbre is the one worth carrying over: it is what a user actually
 * heard, and someone who went looking for the quietest option should not be
 * handed a louder one by an update. The old pattern and button set are
 * dropped, because the set they belong to now decides both.
 */
const LEGACY_TIMBRES: Record<string, SoundSet> = {
  bowl: "bowl",
  bell: "bell",
  marimba: "felt",
  pulse: "felt",
};

interface StoredSound {
  sound?: unknown;
  /** Only present in preferences written before the sets existed. */
  timbre?: unknown;
}

function readSound(value: StoredSound): SoundSet {
  if (SOUND_SETS.includes(value.sound as SoundSet)) return value.sound as SoundSet;
  if (typeof value.timbre === "string" && value.timbre in LEGACY_TIMBRES) {
    return LEGACY_TIMBRES[value.timbre];
  }
  return DEFAULT_PREFS.sound;
}

/** Accepts a stored string only if it is still one of the options we offer. */
function readOption<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Stored settings are treated as untrusted input. They can be hand-edited,
 * left over from an older build with different limits, or corrupted — so each
 * one goes back through the same clamp the controls use rather than being
 * believed on sight.
 */
function readConfig(value: unknown): TimerConfig {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_CONFIG };

  const stored = value as Partial<TimerConfig>;
  return {
    focusMinutes: clampSetting("focusMinutes", Number(stored.focusMinutes)),
    breakMinutes: clampSetting("breakMinutes", Number(stored.breakMinutes)),
    focusSessions: clampSetting("focusSessions", Number(stored.focusSessions)),
  };
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_PREFS };
    }

    const value = parsed as Partial<Prefs>;
    return {
      compact: typeof value.compact === "boolean" ? value.compact : false,
      scale: readNumber(value.scale, MIN_SCALE, MAX_SCALE, DEFAULT_PREFS.scale),
      volume: readNumber(value.volume, 0, 1, DEFAULT_PREFS.volume),
      sound: readSound(value),
      ambience: readOption(
        value.ambience,
        AMBIENCE_MODES,
        DEFAULT_PREFS.ambience
      ),
      config: readConfig(value.config),
      position: readPosition(value.position),
    };
  } catch {
    // Corrupt or unavailable storage should never keep the widget from opening.
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Non-fatal: the widget simply forgets between runs.
  }
}
