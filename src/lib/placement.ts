/**
 * Is a remembered window position still a place the user could reach?
 *
 * Restoring a position without asking is how a widget disappears. Unplug the
 * second monitor, open Gloam, and it opens onto coordinates that no longer
 * exist — and this particular widget has no frame, no taskbar presence worth
 * the name, and a lock mode that removes its own close button. The tray can
 * recover it, but a window that needs recovering on every launch is a window
 * that does not work.
 *
 * So a saved position is a suggestion, checked against the monitors that are
 * actually attached at the moment of asking. When it fails the check the
 * caller falls back to where the window would have opened anyway, rather than
 * nudging it to the nearest valid spot: appearing in the usual corner is
 * something a user can predict, and appearing somewhere arithmetic chose is
 * not.
 *
 * Everything here is in physical desktop pixels, which is what both the window
 * and the monitor list are measured in. No scaling, no conversion, nothing to
 * get subtly wrong.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * How much of the widget has to be on a screen, in each direction, for the
 * position to count as usable.
 *
 * Enough to see it and get a pointer onto it. The whole widget is a drag
 * handle, so any decent corner of it is enough to pull the rest back into
 * view.
 */
export const MIN_VISIBLE_PX = 48;

/** How far two rectangles overlap on each axis. Negative when they miss. */
function overlap(a: Rect, b: Rect): { x: number; y: number } {
  return {
    x: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    y: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  };
}

/**
 * Whether `window` shows enough of itself on at least one of `monitors`.
 *
 * Both axes have to clear the margin on the *same* monitor. Summing across
 * monitors would be wrong in the case that matters: a window spanning the gap
 * between two screens can have plenty of horizontal overlap with one and
 * plenty of vertical overlap with the other while being visible on neither.
 */
export function isReachable(
  window: Rect,
  monitors: readonly Rect[],
  margin: number = MIN_VISIBLE_PX
): boolean {
  return monitors.some((monitor) => {
    const { x, y } = overlap(window, monitor);
    return x >= margin && y >= margin;
  });
}

/** How far a resting widget keeps from the edges of the space it is given. */
export const RESTING_MARGIN_PX = 24;

/**
 * Where the widget goes the very first time, before anyone has moved it.
 *
 * Bottom right, near the tray, because that is where a thing you glance at
 * belongs and it is the corner least likely to have something under it. Inside
 * the *work area* rather than the screen, so it sits above the taskbar instead
 * of behind it, and inset from the edges, because a window flush against a
 * corner reads as stuck there rather than placed.
 *
 * The height asked for is the widget **with the panel unfolded**, not as it
 * stands. Everything grows downward from here — the settings, and on the very
 * first run the tour, which is the one thing that absolutely must be readable
 * before anybody has learned anything. Placing by the resting height would put
 * the introduction under the taskbar.
 *
 * Which does leave the widget floating a little high with nothing open. That
 * is the trade, and it is only the starting position: the moment it is dragged
 * anywhere, that is what gets remembered instead.
 *
 * Everything here is in physical pixels, which is what a work area is measured
 * in. Clamped to the work area's own corner so that a screen too small for the
 * widget puts it somewhere visible rather than off the top.
 */
export function restingPlace(
  work: Rect,
  unfolded: { width: number; height: number },
  margin: number = RESTING_MARGIN_PX
): Point {
  return {
    x: Math.max(work.x, work.x + work.width - unfolded.width - margin),
    y: Math.max(work.y, work.y + work.height - unfolded.height - margin),
  };
}
