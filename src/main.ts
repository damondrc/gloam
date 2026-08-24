import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { NORMAL_SIZE, PANEL_HEIGHT } from "./lib/layout";
import { isReachable, restingPlace } from "./lib/placement";
import { loadPrefs } from "./lib/prefs";
import {
  listMonitors,
  primaryWorkArea,
  readOuterRect,
  setWindowPosition,
} from "./lib/window";

/**
 * Decide where the window goes, before the app is mounted.
 *
 * Done here, and that placement is the whole trick. The window is transparent
 * and nothing has painted into it yet, so there is nothing on screen to see
 * move: by the time the widget draws itself, it draws in the right place.
 * Doing it after mounting would work just as well and would look like the
 * widget jumping across the desktop on every launch.
 */
async function place(): Promise<void> {
  const { position, scale } = loadPrefs();

  if (position) await restore(position);
  else await settle(scale);
}

/**
 * Put it back where it was left — if that is still somewhere it could be
 * reached.
 *
 * A position is only good for the arrangement of screens it was recorded on,
 * and unplugging a monitor is an ordinary thing to do to a laptop. When the
 * check fails nothing happens and the window opens where it would have opened
 * anyway, which is a corner the user can predict; nudging it to the nearest
 * valid spot would be a position arithmetic chose for them.
 */
async function restore(position: { x: number; y: number }): Promise<void> {
  const [rect, monitors] = await Promise.all([readOuterRect(), listMonitors()]);
  if (!rect || monitors.length === 0) return;

  if (isReachable({ ...rect, ...position }, monitors)) {
    await setWindowPosition(position.x, position.y);
  }
}

/**
 * Choose a corner, the first time and only the first time.
 *
 * The size asked for is the widget with its panel unfolded, because everything
 * grows downward from wherever this puts it — and on this particular launch
 * what unfolds is the tour, which is the one thing that has to be readable
 * before anybody has learned anything at all.
 *
 * Design pixels are multiplied by the user's scale to get logical ones, and by
 * the monitor's scale factor to get physical ones, which is what a work area
 * is measured in. Two multiplications, two different meanings of "scale", and
 * mixing them up would put the widget roughly but never exactly right.
 */
async function settle(scale: number): Promise<void> {
  const screen = await primaryWorkArea();
  if (!screen) return;

  const factor = scale * screen.scaleFactor;
  const at = restingPlace(screen.rect, {
    width: NORMAL_SIZE.width * factor,
    height: (NORMAL_SIZE.height + PANEL_HEIGHT) * factor,
  });

  await setWindowPosition(Math.round(at.x), Math.round(at.y));
}

// Nothing here is worth failing to start over. A widget in the wrong corner is
// a small annoyance; a widget that does not open is not one at all.
try {
  await place();
} catch (error) {
  console.warn("gloam: could not place the window", error);
}

const target = document.getElementById("app");
if (!target) throw new Error("#app container not found");

export default mount(App, { target });
