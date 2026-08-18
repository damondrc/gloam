import { describe, expect, it } from "vitest";
import { resolveShortcut } from "./shortcuts";
import type { Action } from "./shortcuts";

/**
 * Every key the widget answers, and what it means. Written out here rather
 * than imported so that the test asserts the intended mapping instead of
 * agreeing with whatever the module currently does.
 */
const BOUND: readonly [string, Action][] = [
  [" ", "toggleTimer"],
  ["c", "toggleCompact"],
  [",", "togglePanel"],
  ["+", "scaleUp"],
  ["=", "scaleUp"],
  ["-", "scaleDown"],
  ["_", "scaleDown"],
];

/**
 * Keys that used to do something and deliberately no longer do.
 *
 * Asserted rather than simply deleted, because the reason they went is a rule
 * — nothing destructive on an unmodified letter, in a window that can hold the
 * focus without the user thinking about it — and a rule that is only recorded
 * in a commit message is one that gets undone by the next person who thinks a
 * shortcut would be convenient.
 */
const REFUSED = [
  ["s", "skipping a segment throws away time already served"],
  ["r", "resetting discards the run"],
  ["l", "locking hides the close button and stops clicks landing"],
  ["0", "the grip resets the scale, and has Home for it"],
] as const;

const free = { ownsSpace: false };
const inControl = { ownsSpace: true };

describe("resolveShortcut", () => {
  it.each(BOUND)("binds %j to %s", (key, action) => {
    expect(resolveShortcut(key, free)?.action).toBe(action);
  });

  // The widget has no text input, so a letter is never something being typed.
  // Both cases have to work: the shift key is how `+` and `_` are reached.
  it.each(BOUND)("treats %j the same in either case", (key) => {
    expect(resolveShortcut(key.toUpperCase(), free)).toEqual(
      resolveShortcut(key.toLowerCase(), free)
    );
  });

  it.each(["a", "z", "1", "Escape", "Enter", "Tab", "ArrowUp", "."])(
    "leaves %j alone",
    (key) => {
      expect(resolveShortcut(key, free)).toBeNull();
    }
  );

  it.each(REFUSED)("refuses %j, because %s", (key) => {
    expect(resolveShortcut(key, free)).toBeNull();
    expect(resolveShortcut(key.toUpperCase(), free)).toBeNull();
  });

  // A binding nothing can reach is a shortcut that does not exist, and the
  // table above is the only place that would say so.
  it("can produce every action there is", () => {
    const reachable = new Set(BOUND.map(([, action]) => action));
    const declared: Action[] = [
      "toggleTimer",
      "toggleCompact",
      "togglePanel",
      "scaleUp",
      "scaleDown",
    ];

    expect([...reachable].sort()).toEqual([...declared].sort());
  });

  describe("when a control has the focus", () => {
    // Suppressing the default is how the page is stopped from scrolling, and
    // it is also how a button is stopped from firing. A focused settings tab
    // has to keep its own key.
    it("gives up the spacebar", () => {
      expect(resolveShortcut(" ", inControl)).toBeNull();
    });

    // The opposite failure is just as easy to write: an over-broad guard that
    // swallows every key, so that opening the panel with the pointer would
    // stop `c` from folding the widget.
    it.each(BOUND.filter(([key]) => key !== " "))(
      "keeps %j",
      (key, action) => {
        expect(resolveShortcut(key, inControl)?.action).toBe(action);
      }
    );
  });

  describe("preventDefault", () => {
    it("is asked for on the spacebar, which would otherwise scroll", () => {
      expect(resolveShortcut(" ", free)?.preventDefault).toBe(true);
    });

    // Suppressing a default nobody has is how a shortcut quietly breaks
    // something else later.
    it.each(BOUND.filter(([key]) => key !== " "))(
      "is not asked for on %j",
      (key) => {
        expect(resolveShortcut(key, free)?.preventDefault).toBe(false);
      }
    );
  });
});
