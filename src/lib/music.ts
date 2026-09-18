/**
 * The music player, from this side of the bridge.
 *
 * Every call here is a thin wrapper over a Rust command, guarded the same way
 * `window.ts` is so the visual layer still runs under a plain `npm run dev` in
 * a browser. Nothing is decoded, buffered or timed here — the WebView never
 * touches an audio file, which is the entire reason this feature has a Rust
 * half at all.
 *
 * The frontend holds no copy of the queue. What is playing, and where in the
 * folder it is, lives in Rust and arrives as a snapshot: either as the return
 * of a command or on the track event. Two copies of that would be two copies
 * that disagree the first time a track ends while nobody is looking.
 */

import { inTauri } from "./window";

/** What Rust says about the player, as a whole answer rather than a field. */
export interface MusicState {
  /** How many playable files the folder held. */
  count: number;
  /** Which one is current, or null when the folder is empty. */
  index: number | null;
  /** The current file's name, without path or extension. */
  name: string | null;
  playing: boolean;
}

export const EMPTY: MusicState = {
  count: 0,
  index: null,
  name: null,
  playing: false,
};

async function core(): Promise<typeof import("@tauri-apps/api/core") | null> {
  if (!inTauri()) return null;
  return await import("@tauri-apps/api/core");
}

/**
 * Anything that fails here leaves the widget alone.
 *
 * Gloam is a timer that can play music, not a music player that keeps time. A
 * missing audio device, a folder that has gone, a file nothing can decode —
 * none of those is a reason for a countdown to stop.
 */
async function ask<T>(command: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  try {
    const m = await core();
    if (!m) return fallback as T;
    return await m.invoke<T>(command, args);
  } catch (error) {
    console.warn(`gloam: ${command} failed`, error);
    return fallback as T;
  }
}

/** Reads a folder and takes its playable files as the queue, stopped. */
export const openFolder = (folder: string): Promise<MusicState> =>
  ask<MusicState>("music_open", { folder }, EMPTY);

/**
 * Asks the operating system for a folder, and returns its path unopened.
 *
 * The native picker rather than anything of Gloam's own, and not only because
 * writing a file browser into a 320-pixel widget would be absurd. The path has
 * to reach Rust, and the WebView cannot hand one over: a `<input
 * type="file" webkitdirectory>` yields file handles inside the sandbox, which
 * is precisely what this feature exists to avoid touching.
 *
 * Returns the path rather than opening it, because choosing a folder and
 * remembering one are the same act from here and the caller is what knows
 * whether this one is worth writing down.
 */
export async function pickFolder(): Promise<string | null> {
  if (!inTauri()) return null;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({ directory: true, multiple: false });
    return typeof picked === "string" ? picked : null;
  } catch (error) {
    console.warn("gloam: the folder picker did not open", error);
    return null;
  }
}

/**
 * The last part of a path, which is the only part that fits.
 *
 * A stored folder is an absolute path and the panel has about 180 design
 * pixels for it. Eliding the middle would keep a drive letter nobody needs and
 * lose the word that identifies the place; the folder's own name is what the
 * person called it, so that is what is shown, with the whole path on hover.
 */
export function folderName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export const play = (): Promise<void> => ask<void>("music_play");
export const pause = (): Promise<void> => ask<void>("music_pause");
export const next = (): Promise<void> => ask<void>("music_next");
export const previous = (): Promise<void> => ask<void>("music_prev");

/** Jumps to a track, playing or merely selecting it. */
export const at = (index: number, playing = true): Promise<void> =>
  ask<void>("music_at", { index, play: playing });

/** 0 to 1, and not the same control as the widget's own volume. */
export const setVolume = (volume: number): Promise<void> =>
  ask<void>("music_volume", { volume });

export const status = (): Promise<MusicState> =>
  ask<MusicState>("music_status", undefined, EMPTY);

/**
 * Fires whenever the track changes, for any reason — finished, skipped, or a
 * folder being opened. Returns an unlisten function.
 */
export async function onTrack(
  handler: (state: MusicState) => void
): Promise<() => void> {
  if (!inTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<MusicState>("gloam://music-track", ({ payload }) =>
    handler(payload)
  );
}
