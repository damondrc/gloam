import { describe, expect, it } from "vitest";
import { contains } from "./hitbox";
import type { Frame, Rect } from "./hitbox";

/** The padlock's rectangle at rest: 20 CSS px square, 8 in from the corner. */
const PADLOCK: Rect = { left: 292, top: 8, right: 312, bottom: 28 };

const PAD = 6;

/**
 * The three arrangements that matter, and the reason the conversion exists at
 * all. A single monitor at 100% is the case where every mistake is invisible,
 * because scaling by one and offsetting by a small number looks the same as
 * doing nothing.
 */
const FRAMES: readonly [string, Frame][] = [
  ["primary monitor, 100%", { x: 48, y: 48, scale: 1 }],
  ["secondary monitor, 150%", { x: 1920, y: 0, scale: 1.5 }],
  ["monitor to the left of the primary", { x: -1600, y: -220, scale: 1 }],
];

/** Where a CSS point inside the window lands on the desktop. */
const at = (frame: Frame, cssX: number, cssY: number) => ({
  x: frame.x + cssX * frame.scale,
  y: frame.y + cssY * frame.scale,
});

describe("contains", () => {
  describe.each(FRAMES)("on the %s", (_, frame) => {
    it("finds the middle of the rectangle", () => {
      expect(contains(PADLOCK, frame, at(frame, 302, 18), PAD)).toBe(true);
    });

    // Each edge from both sides, which is where an off-by-one in the scaling
    // or the offset shows up and nowhere else.
    it.each([
      ["left", 292 - PAD + 1, 18, true],
      ["left", 292 - PAD - 1, 18, false],
      ["right", 312 + PAD - 1, 18, true],
      ["right", 312 + PAD + 1, 18, false],
      ["top", 302, 8 - PAD + 1, true],
      ["top", 302, 8 - PAD - 1, false],
      ["bottom", 302, 28 + PAD - 1, true],
      ["bottom", 302, 28 + PAD + 1, false],
    ])("puts the %s edge where it belongs", (_edge, cssX, cssY, expected) => {
      expect(contains(PADLOCK, frame, at(frame, cssX, cssY), PAD)).toBe(
        expected
      );
    });

    it("stays out of the rest of the widget", () => {
      expect(contains(PADLOCK, frame, at(frame, 40, 100), PAD)).toBe(false);
    });

    // The padding is given in CSS pixels, so the hotspot has to be as
    // forgiving to hit at 180% as at 80%. A pad left in physical pixels would
    // silently be a different-sized target at every scale.
    it("grows the hotspot by the same CSS distance whatever the scale", () => {
      const justOutside = at(frame, 292 - PAD - 1, 18);

      expect(contains(PADLOCK, frame, justOutside, PAD)).toBe(false);
      expect(contains(PADLOCK, frame, justOutside, PAD + 2)).toBe(true);
    });
  });

  // The failure this function exists to prevent: treating a CSS rectangle as
  // though it were already in desktop pixels. At 100% on a window at the
  // origin the two agree, and everywhere else they do not.
  it("does not confuse CSS pixels with physical ones", () => {
    const frame: Frame = { x: 0, y: 0, scale: 2 };

    // Where the rectangle would be if the scale were ignored.
    expect(contains(PADLOCK, frame, { x: 302, y: 18 }, PAD)).toBe(false);
    // Where it actually is.
    expect(contains(PADLOCK, frame, { x: 604, y: 36 }, PAD)).toBe(true);
  });

  it("is not fooled by a matching x on the wrong row", () => {
    const frame: Frame = { x: 0, y: 0, scale: 1 };

    expect(contains(PADLOCK, frame, { x: 302, y: 18 }, PAD)).toBe(true);
    expect(contains(PADLOCK, frame, { x: 302, y: 400 }, PAD)).toBe(false);
  });
});
