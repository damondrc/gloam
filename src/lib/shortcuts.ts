/**
 * What each key means.
 *
 * Pulled out of the component for the same reason `plan.ts` was pulled out of
 * the timer: this is a table of decisions, and a table of decisions inside a
 * `switch` inside a Svelte file cannot be asked a question without a browser.
 * What is left here is ordinary TypeScript that takes a key and returns an
 * intention. Which function that intention calls stays in `App.svelte`, where
 * the things being called live.
 *
 * One rule decides what is in the table: **a key is bound only if what it does
 * is reversible, cheap to undo, and reachable some other way.**
 *
 * The reason is what Gloam is. It sits on top of everything, it can hold the
 * keyboard focus without the user thinking of it as the application they are
 * in, and its whole argument is that it should be possible to forget about.
 * A window like that must not be able to discard a session because a letter
 * was typed at it. Skipping and resetting are destructive; locking hides the
 * close button and hands every click to whatever is underneath. None of the
 * three belongs on an unmodified letter, and all three have a button.
 *
 * Lock keeps `Ctrl+Alt+G`, registered in Rust. Modified, so it cannot be hit
 * by accident, and global, so it works when the widget cannot be clicked —
 * which is the one situation the escape hatch exists for.
 *
 * What is left starts or pauses a run, folds the widget, opens the panel, and
 * resizes. Every one of them is undone by pressing it again.
 */

export type Action =
  | "toggleTimer"
  | "toggleCompact"
  | "togglePanel"
  | "scaleUp"
  | "scaleDown";

export interface Context {
  /**
   * True when the spacebar belongs to whatever has the focus — a button or a
   * form control that the user reached with the keyboard.
   *
   * Focus left behind by a mouse click does not count, and the distinction is
   * the point: after clicking the padlock, the padlock still holds the focus,
   * and the space bar would press it again instead of starting the run. Nobody
   * who clicked a button expects the keyboard to still be pointed at it.
   *
   * It is the caller's job to work this out, because answering it means asking
   * the DOM, and this module exists precisely so that the rules can be checked
   * without one.
   */
  ownsSpace: boolean;
}

export interface Shortcut {
  action: Action;
  /**
   * True when the browser's own handling of the key has to be suppressed.
   *
   * Only the spacebar needs it, and only to stop the page scrolling. It is
   * reported rather than assumed because suppressing the default is also what
   * stops a button firing, which is the whole reason `ownsSpace` exists.
   */
  preventDefault: boolean;
}

/**
 * Lower-cased keys. `+` and `=` are the same physical key with and without
 * shift, and so are `-` and `_`; binding both means the scale responds to
 * that key however it is pressed, on any layout that puts them together.
 */
const BINDINGS: Record<string, Action | undefined> = {
  " ": "toggleTimer",
  c: "toggleCompact",
  ",": "togglePanel",
  "+": "scaleUp",
  "=": "scaleUp",
  "-": "scaleDown",
  _: "scaleDown",
};

export function resolveShortcut(key: string, context: Context): Shortcut | null {
  const action = BINDINGS[key.toLowerCase()];
  if (!action) return null;

  // Space is the only key a focused control also claims. Every other binding
  // is a character no button has a meaning for, so they stay global — pressing
  // `s` with the focus left on the play button should still skip.
  if (action === "toggleTimer") {
    if (context.ownsSpace) return null;
    return { action, preventDefault: true };
  }

  return { action, preventDefault: false };
}

/**
 * The keys as a reader needs them, for the panel to show.
 *
 * A second table, and deliberately not derived from the first. `BINDINGS` maps
 * a key to an intention and knows nothing about wording; this one is the
 * wording, and includes `Ctrl+Alt+G`, which is registered in Rust and never
 * reaches this module at all.
 *
 * What stops the two drifting is a test rather than a shared structure: every
 * action the bindings can produce has to appear here, so adding a shortcut
 * without documenting it fails rather than shipping a key nobody is told
 * about.
 */
export interface ShownShortcut {
  keys: string;
  does: string;
  /** Empty for the global shortcut, which is not one of these bindings. */
  actions: readonly Action[];
}

export const SHORTCUTS: readonly ShownShortcut[] = [
  { keys: "Space", does: "Start or pause", actions: ["toggleTimer"] },
  { keys: "C", does: "Fold to compact", actions: ["toggleCompact"] },
  { keys: ",", does: "Open settings", actions: ["togglePanel"] },
  { keys: "+ / −", does: "Resize", actions: ["scaleUp", "scaleDown"] },
  { keys: "Ctrl+Alt+G", does: "Lock, from anywhere", actions: [] },
];
