/**
 * What the widget can do while it is being worked on, and not after.
 *
 * `import.meta.env.DEV` is the literal `true` under `npm run app` and the
 * literal `false` once Vite builds a release, so everything below collapses to
 * an empty object that the bundler then removes. This is not a hidden setting
 * somebody could find in a shipped Gloam: in a shipped Gloam it is not there.
 *
 * The rule for anything that lands in this file is that it may only *add* a
 * choice, never change one. A test build has to behave like a release build
 * until the moment you deliberately ask it not to, or it stops being a test of
 * anything.
 */

import type { SettingKey } from "./plan";

/**
 * Half a minute, which is nobody's idea of a focus session.
 *
 * Five minutes is the shortest session worth starting and one minute the
 * shortest break, and both of those numbers are right for using Gloam. They
 * are the wrong numbers for looking at it. The sky spends an entire session
 * getting from afternoon to dark, and the city spends an entire break going to
 * sleep — so checking that the lights come on and go out in the right order
 * costs forty minutes of waiting every time a number moves. At thirty seconds
 * a segment, a whole evening takes a minute.
 */
export const TEST_MINUTES = 0.5;

/**
 * The extra stop, per setting, or nothing at all in a release build.
 *
 * One stop *below* the range rather than a lower minimum, so the ordinary
 * values keep their own grid: down from 5 lands on 0.5, up from 0.5 lands back
 * on 5, and nothing in between is reachable. A lower minimum would have put
 * 5.5 and 10.5 on the way back up, which is a worse settings panel in exchange
 * for a shortcut nobody using the app wants.
 *
 * Sessions are deliberately left out. A run of one is already the shortest
 * thing worth watching, and the number of them is not what makes a test take
 * too long.
 *
 * A value picked here is stored like any other preference and survives a
 * restart of the dev build, which is the point — it is a setting you leave on
 * while you are working on the sky. It cannot escape into a release, though:
 * with no floor on offer, `clampSetting` sends a stored 0.5 back up to the
 * real minimum the first time a shipped build reads its preferences.
 */
export const TEST_FLOOR: Partial<Record<SettingKey, number>> = import.meta.env
  .DEV
  ? { focusMinutes: TEST_MINUTES, breakMinutes: TEST_MINUTES }
  : {};
