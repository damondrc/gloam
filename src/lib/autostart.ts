/**
 * Whether Gloam launches with the session.
 *
 * The one setting that is not a preference. It lives in the operating system —
 * a value under `Run` in the Windows registry, a `.desktop` file in
 * `~/.config/autostart` on Linux — and it can be changed from outside the app
 * entirely, by Task Manager or a startup applications dialogue. So it is
 * asked for rather than remembered: nothing here writes to `gloam.prefs.v1`,
 * because a second copy of a fact is a second copy that can be wrong.
 *
 * Guarded the same way `window.ts` is, so the visual layer still runs under a
 * plain `npm run dev` in a browser, where there is no Tauri bridge and no
 * session to launch with.
 */

import { inTauri } from "./window";

type AutostartModule = typeof import("@tauri-apps/plugin-autostart");

let cached: AutostartModule | null = null;

async function api(): Promise<AutostartModule | null> {
  if (!inTauri()) return null;
  cached ??= await import("@tauri-apps/plugin-autostart");
  return cached;
}

/**
 * Whether the startup entry exists right now.
 *
 * Answers false rather than throwing when it cannot tell. The control this
 * feeds is a switch, and a switch has to show something; off is the honest
 * guess, because it is the state the machine is in if nothing was registered.
 */
export async function launchesAtLogin(): Promise<boolean> {
  try {
    return (await (await api())?.isEnabled()) ?? false;
  } catch (error) {
    console.warn("gloam: could not read the startup entry", error);
    return false;
  }
}

/**
 * Adds or removes the startup entry, and reports what is true afterwards.
 *
 * The return value is read back from the plugin rather than assumed from the
 * argument. Writing to the registry or to a config directory is exactly the
 * kind of thing a locked-down machine refuses, and a switch that flips itself
 * on when nothing happened is worse than one that stays where it was.
 */
export async function setLaunchAtLogin(value: boolean): Promise<boolean> {
  const m = await api();
  if (!m) return false;

  try {
    if (value) await m.enable();
    else await m.disable();
  } catch (error) {
    console.warn("gloam: could not change the startup entry", error);
  }

  return launchesAtLogin();
}
