/**
 * Is the cursor over the padlock?
 *
 * Four lines of arithmetic that decide whether a locked widget is currently
 * letting clicks in, which makes them the most consequential four lines in the
 * lock path: get them wrong and the padlock is a button that cannot be
 * pressed, on a window that accepts nothing else.
 *
 * They live here, apart from the controller, because there they sat behind two
 * IPC round trips — you could not ask what they compute without a desktop to
 * ask it on. Alone, they are a function of four numbers.
 *
 * The conversion is the whole job. A DOM rectangle is measured in CSS pixels
 * from the window's client area; the cursor is reported in physical pixels
 * from the corner of the desktop. Scale one, offset by the other.
 */

/** A rectangle in CSS pixels, relative to the window's client area. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where the client area starts, in physical desktop pixels, and how many
 * physical pixels there are to a CSS one.
 *
 * The client area rather than the window: a DOM rectangle is measured from
 * there, so anything converting one has to start from the same place. On
 * Windows with decorations off the two coincide; GTK keeps a frame band above
 * the content, and starting from the wrong one shifts every result upward by
 * its height.
 */
export interface Frame {
  x: number;
  y: number;
  scale: number;
}

/** A point in physical desktop pixels. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Whether `cursor` falls inside `rect`, grown by `padCssPx` on every side.
 *
 * The padding is given in CSS pixels and scaled with everything else, so the
 * hotspot is as forgiving to hit at 180% as it is at 80% — a pad that stayed
 * in physical pixels would be a different-sized target at every scale.
 */
export function contains(
  rect: Rect,
  frame: Frame,
  cursor: Point,
  padCssPx: number
): boolean {
  const { x, y, scale } = frame;
  const pad = padCssPx * scale;

  const left = x + rect.left * scale - pad;
  const top = y + rect.top * scale - pad;
  const right = x + rect.right * scale + pad;
  const bottom = y + rect.bottom * scale + pad;

  return (
    cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom
  );
}
