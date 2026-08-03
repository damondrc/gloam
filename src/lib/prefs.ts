/**
 * Preferences that should survive a restart.
 *
 * localStorage is enough while the set is this small and non-sensitive. When
 * the settings panel lands and durations move here too, this is the seam to
 * swap for a JSON file managed by Rust.
 */

import { MAX_SCALE, MIN_SCALE } from "./scale.svelte";

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
}

export const DEFAULT_PREFS: Prefs = {
  compact: false,
  scale: 1,
  volume: 0.6,
};

function readNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
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
