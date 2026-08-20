import { describe, expect, it } from "vitest";
import { isReachable, MIN_VISIBLE_PX } from "./placement";
import type { Rect } from "./placement";

/** A laptop screen, with a second monitor to the right and one above it. */
const PRIMARY: Rect = { x: 0, y: 0, width: 1920, height: 1080 };
const RIGHT: Rect = { x: 1920, y: 0, width: 2560, height: 1440 };
const LEFT: Rect = { x: -1600, y: -200, width: 1600, height: 900 };

const LAYOUT = [PRIMARY, RIGHT, LEFT];

/** The widget at rest: 320 by 132 design pixels, at 100%. */
const at = (x: number, y: number): Rect => ({ x, y, width: 320, height: 132 });

describe("isReachable", () => {
  it("accepts a window sitting where it was left", () => {
    expect(isReachable(at(48, 48), LAYOUT)).toBe(true);
  });

  it.each([
    ["the monitor to the right", at(2400, 300)],
    ["the monitor above and to the left", at(-1200, -100)],
  ])("accepts one on %s", (_, rect) => {
    expect(isReachable(rect, LAYOUT)).toBe(true);
  });

  // The failure the whole check exists for: a position that was perfectly
  // good yesterday, on a screen that is no longer plugged in.
  it("rejects a position from a monitor that has gone", () => {
    const onTheSecondScreen = at(2400, 300);

    expect(isReachable(onTheSecondScreen, LAYOUT)).toBe(true);
    expect(isReachable(onTheSecondScreen, [PRIMARY])).toBe(false);
  });

  it("rejects a window with no monitors at all", () => {
    expect(isReachable(at(48, 48), [])).toBe(false);
  });

  describe("the margin", () => {
    // Exactly the margin is enough; a pixel less is not. Off-by-one here is
    // the difference between a widget you can grab and one you cannot.
    it.each([
      ["exactly the margin showing", 1920 - MIN_VISIBLE_PX, true],
      ["a pixel less than the margin", 1920 - MIN_VISIBLE_PX + 1, false],
    ])("%s", (_, x, expected) => {
      expect(isReachable(at(x, 500), [PRIMARY])).toBe(expected);
    });

    it("applies on the vertical as well", () => {
      expect(isReachable(at(400, 1080 - MIN_VISIBLE_PX), [PRIMARY])).toBe(true);
      expect(isReachable(at(400, 1080 - MIN_VISIBLE_PX + 1), [PRIMARY])).toBe(
        false
      );
    });

    it("applies above and to the left of the origin too", () => {
      expect(isReachable(at(MIN_VISIBLE_PX - 320, 400), [PRIMARY])).toBe(true);
      expect(isReachable(at(MIN_VISIBLE_PX - 321, 400), [PRIMARY])).toBe(false);
    });
  });

  /**
   * The reason both axes have to clear the margin on the *same* monitor.
   *
   * A wide screen across the top and a tall one down the right leave a corner
   * belonging to neither. A window parked there overlaps the wide one
   * horizontally, because it is under the middle of it, and the tall one
   * vertically, because it is level with it — two generous overlaps, on two
   * different screens, and not one pixel of the widget visible on either.
   *
   * Take the axes separately and this window looks perfectly reachable.
   */
  it("does not add up overlap from different monitors", () => {
    const band: Rect = { x: 0, y: 0, width: 2000, height: 400 };
    const column: Rect = { x: 2500, y: 0, width: 500, height: 2000 };
    const inTheCorner: Rect = { x: 1000, y: 600, width: 200, height: 100 };

    // Horizontally it is well inside the band; vertically it is well inside
    // the column. Neither of those is being on a screen.
    expect(isReachable(inTheCorner, [band], 100)).toBe(false);
    expect(isReachable(inTheCorner, [column], 100)).toBe(false);
    expect(isReachable(inTheCorner, [band, column], 100)).toBe(false);
  });

  it("accepts a window straddling two monitors", () => {
    expect(isReachable(at(1800, 400), LAYOUT)).toBe(true);
  });

  // A stored position is untrusted input like any other, and a monitor list
  // arrives from the platform.
  it.each([
    ["far off to the right", at(99_999, 0)],
    ["far above everything", at(0, -99_999)],
  ])("rejects one %s", (_, rect) => {
    expect(isReachable(rect, LAYOUT)).toBe(false);
  });
});
