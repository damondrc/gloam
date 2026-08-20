import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { isReachable } from "./lib/placement";
import { loadPrefs } from "./lib/prefs";
import { listMonitors, readOuterRect, setWindowPosition } from "./lib/window";

/**
 * Put the window back where it was left.
 *
 * Done here, before the app is mounted, and that placement is the whole trick.
 * The window is transparent and nothing has painted into it yet, so there is
 * nothing on screen to see move: by the time the widget draws itself, it draws
 * in the right place. Moving it after mounting would work just as well and
 * would look like the widget jumping across the desktop on every launch.
 *
 * The saved position is checked against the monitors that are attached right
 * now rather than trusted. A position is only good for the arrangement of
 * screens it was recorded on, and unplugging a monitor is not an unusual thing
 * to do to a laptop. When it no longer works out, nothing happens and the
 * window stays where it opened, which is a corner the user can predict.
 */
async function restorePosition(): Promise<void> {
  const { position } = loadPrefs();
  if (!position) return;

  const [rect, monitors] = await Promise.all([readOuterRect(), listMonitors()]);
  if (!rect || monitors.length === 0) return;

  // The size it has now, at the position it wants: what the window would
  // occupy if the request were granted.
  if (isReachable({ ...rect, ...position }, monitors)) {
    await setWindowPosition(position.x, position.y);
  }
}

// Nothing here is worth failing to start over. A widget in the wrong corner is
// a small annoyance; a widget that does not open is not one at all.
try {
  await restorePosition();
} catch (error) {
  console.warn("gloam: could not restore the window position", error);
}

const target = document.getElementById("app");
if (!target) throw new Error("#app container not found");

export default mount(App, { target });
