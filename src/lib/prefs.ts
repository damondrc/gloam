/**
 * Preferences that should survive a restart.
 *
 * localStorage is enough while the set is this small and non-sensitive. When
 * the settings panel lands and durations move here too, this is the seam to
 * swap for a JSON file managed by Rust.
 */

import { clampSetting, DEFAULT_CONFIG } from "./plan";
import type { TimerConfig } from "./plan";
import { MAX_SCALE, MIN_SCALE } from "./scale.svelte";
import { INTERFACE_STYLES, TIMBRES } from "./sound";
import type { InterfaceStyle, Timbre } from "./sound";

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
  timbre: Timbre;
  interfaceStyle: InterfaceStyle;
  config: TimerConfig;
}

export const DEFAULT_PREFS: Prefs = {
  compact: false,
  scale: 1,
  volume: 0.6,
  timbre: "bowl",
  interfaceStyle: "soft",
  config: { ...DEFAULT_CONFIG },
};

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
      timbre: readOption(value.timbre, TIMBRES, DEFAULT_PREFS.timbre),
      interfaceStyle: readOption(
        value.interfaceStyle,
        INTERFACE_STYLES,
        DEFAULT_PREFS.interfaceStyle
      ),
      config: readConfig(value.config),
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
