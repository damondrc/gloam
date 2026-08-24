import { describe, expect, it } from "vitest";
import { isReachable, MIN_VISIBLE_PX, restingPlace, RESTING_MARGIN_PX } from "./placement";
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

describe("restingPlace", () => {
  /** A 1080p screen with a 48-pixel taskbar along the bottom. */
  const WORK: Rect = { x: 0, y: 0, width: 1920, height: 1032 };

  /** The widget at its opening scale of 150%, with the panel's height in. */
  const UNFOLDED = { width: 480, height: 483 };

  it("sits in the bottom right, inset from both edges", () => {
    const at = restingPlace(WORK, UNFOLDED);

    expect(at.x).toBe(1920 - 480 - RESTING_MARGIN_PX);
    expect(at.y).toBe(1032 - 483 - RESTING_MARGIN_PX);
  });

  // The taskbar is the whole reason this takes a work area rather than a
  // screen: placing by the screen would put the widget behind it.
  it("stays clear of the taskbar", () => {
    const screen: Rect = { x: 0, y: 0, width: 1920, height: 1080 };

    const byWork = restingPlace(WORK, UNFOLDED);
    const byScreen = restingPlace(screen, UNFOLDED);

    expect(byScreen.y - byWork.y).toBe(1080 - 1032);
  });

  // The height passed in is the widget plus its panel, so that what unfolds
  // downward has somewhere to go. Without that room the tour — which opens on
  // the very first run, at exactly this position — would open off-screen.
  it("leaves room below for what unfolds", () => {
    const folded = { width: 480, height: 198 };

    const withRoom = restingPlace(WORK, UNFOLDED);
    const without = restingPlace(WORK, folded);

    expect(without.y).toBeGreaterThan(withRoom.y);
    expect(withRoom.y + UNFOLDED.height).toBeLessThanOrEqual(
      WORK.y + WORK.height
    );
  });

  // A work area that does not start at the origin is ordinary: a taskbar on
  // the left, or a second monitor as the primary one.
  it("works on a screen that does not start at zero", () => {
    const offset: Rect = { x: 1920, y: -200, width: 2560, height: 1400 };

    const at = restingPlace(offset, UNFOLDED);

    expect(at.x).toBe(1920 + 2560 - 480 - RESTING_MARGIN_PX);
    expect(at.y).toBe(-200 + 1400 - 483 - RESTING_MARGIN_PX);
  });

  // Asserted as behaviour rather than as a number, so that setting the margin
  // to zero fails here rather than quietly shipping a widget welded to the
  // corner. A window flush against an edge reads as stuck there.
  it("never sits flush against a corner", () => {
    const at = restingPlace(WORK, UNFOLDED);

    expect(at.x + UNFOLDED.width).toBeLessThan(WORK.x + WORK.width);
    expect(at.y + UNFOLDED.height).toBeLessThan(WORK.y + WORK.height);
    expect(at.x).toBeGreaterThan(WORK.x);
    expect(at.y).toBeGreaterThan(WORK.y);
  });

  it("respects a margin it is given instead of its own", () => {
    const at = restingPlace(WORK, UNFOLDED, 100);

    expect(at.x).toBe(1920 - 480 - 100);
  });

  // Somewhere visible beats somewhere correct. On a screen too small to hold
  // the unfolded widget the arithmetic would put it off the top left, which
  // is the one outcome that cannot be recovered by looking at it.
  it("pins to the corner rather than going off a screen too small for it", () => {
    const tiny: Rect = { x: 0, y: 0, width: 300, height: 200 };

    const at = restingPlace(tiny, UNFOLDED);

    expect(at).toEqual({ x: 0, y: 0 });
  });
});
