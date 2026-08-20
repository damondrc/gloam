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
