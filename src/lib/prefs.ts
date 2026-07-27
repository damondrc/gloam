/**
 * Preferences that should survive a restart.
 *
 * localStorage is enough while the set is this small and non-sensitive. When
 * the settings panel lands and durations move here too, this is the seam to
 * swap for a JSON file managed by Rust.
 */

const KEY = "gloam.prefs.v1";

export interface Prefs {
  locked: boolean;
  compact: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  locked: false,
  compact: false,
};

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
      locked: typeof value.locked === "boolean" ? value.locked : false,
      compact: typeof value.compact === "boolean" ? value.compact : false,
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
