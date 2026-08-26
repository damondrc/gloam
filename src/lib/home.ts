/**
 * Where Gloam lives.
 *
 * One definition, used twice: the first time the widget ever opens, and every
 * time somebody asks the tray to fetch it back. Those are the same request —
 * *put it where it belongs* — and having them arrive at two different answers
 * would make the recovery entry a surprise rather than a rescue.
 *
 * The geometry itself is in `placement.ts`, which knows nothing about windows
 * and is tested on its own. This is the layer that goes and asks the platform
 * where the screen is, and it is deliberately the only one that does both.
 */

import { COMPACT_SIZE, NORMAL_SIZE, PANEL_HEIGHT } from "./layout";
import { restingPlace } from "./placement";
import { primaryWorkArea, setWindowPosition } from "./window";

/**
 * Puts the widget in its corner of the primary screen.
 *
 * The size asked for is the widget with room for what unfolds below it, not
 * the height it currently stands at: everything grows downward from wherever
 * this puts it, so placing by the resting height would put the settings — and,
 * on the very first launch, the tour — under the taskbar. Compact is the
 * exception, and not an arbitrary one: nothing unfolds from a compact widget,
 * because the chevron is one of the things it folds away.
 *
 * Design pixels are multiplied by the user's scale to get logical ones, and by
 * the monitor's scale factor to get physical ones, which is what a work area
 * is measured in. Two multiplications, two different meanings of "scale", and
 * mixing them up would put the widget roughly but never exactly right.
 *
 * Silent when there is no screen to ask about. Every caller is either opening
 * the app or rescuing it, and neither is improved by an exception.
 */
export async function goHome(scale: number, compact: boolean): Promise<void> {
  const screen = await primaryWorkArea();
  if (!screen) return;

  const base = compact ? COMPACT_SIZE : NORMAL_SIZE;
  const factor = scale * screen.scaleFactor;

  const at = restingPlace(screen.rect, {
    width: base.width * factor,
    height: (base.height + (compact ? 0 : PANEL_HEIGHT)) * factor,
  });

  await setWindowPosition(Math.round(at.x), Math.round(at.y));
}
