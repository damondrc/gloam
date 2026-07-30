/**
 * Lock mode.
 *
 * On a single-monitor setup an always-on-top widget is a liability: it covers
 * the document you are reading and, worse, swallows clicks meant for it.
 * Locking solves that by turning the whole window click-through, so the mouse
 * passes straight to whatever is underneath.
 *
 * The catch is that click-through is a whole-window property — the platform
 * offers no way to say "pass everything through except this button". Without a
 * way back in, locking would be a one-way trip.
 *
 * The way around it is to keep hit-testing ourselves. While locked we poll the
 * global cursor position and compare it against the padlock's rectangle in
 * screen coordinates. The moment the cursor enters that rectangle we turn
 * click-through off so the click can land; the moment it leaves, back on. The
 * polling is cheap (one IPC round trip every 70 ms, and only while locked) and
 * it means the padlock behaves like a physical hole in an otherwise
 * pass-through surface.
 *
 * A global shortcut registered in Rust is the safety net: if hit-testing ever
 * fails on some window manager, the widget is still recoverable.
 */

import { readCursor, readGeometry, setClickThrough } from "./window";
import type { Geometry } from "./window";

const POLL_MS = 70;

/** Re-read window position this often; it only changes if something moves us. */
const GEOMETRY_TTL_MS = 1000;

/** Grows the padlock's clickable rectangle so it is forgiving to hit. */
const HOTSPOT_PADDING_PX = 6;

/**
 * Re-apply the click-through state every this many ticks even when nothing
 * changed. Click-through is write-only — the platform gives us no way to read
 * back whether it actually took — so periodically restating our intent is the
 * only way to recover if a call is ever dropped or overridden.
 */
const REASSERT_EVERY = 10;

/**
 * The controller currently allowed to drive the window.
 *
 * Only one thing may own a window-wide property like click-through. If a
 * second controller ever exists — a hot-reload leaving the previous component
 * instance alive is the realistic way — its polling loop would keep asserting
 * a lock state the user already dismissed, and the window would refuse to
 * unlock for reasons invisible from the UI. Claiming ownership on lock lets
 * any stale instance notice it has been superseded and stand down.
 */
let owner: LockController | null = null;

export class LockController {
  locked = $state(false);
  /** True while the cursor sits over the padlock and clicks are being let in. */
  hot = $state(false);

  #hotspot: HTMLElement | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #geometry: Geometry | null = null;
  #geometryAt = 0;
  #passingThrough = false;
  #stopped = false;
  #ticks = 0;

  /** Registers the element whose bounds stay clickable while locked. */
  attach(element: HTMLElement | null): void {
    this.#hotspot = element;
  }

  toggle(): void {
    this.locked ? this.unlock() : this.lock();
  }

  lock(): void {
    if (this.locked) return;
    owner = this;
    this.locked = true;
    this.hot = false;
    this.#stopped = false;
    this.#geometry = null;
    this.#ticks = 0;
    void this.#enterPassThrough();
    this.#schedule();
  }

  unlock(): void {
    if (!this.locked) return;
    this.locked = false;
    this.hot = false;
    this.#stopped = true;
    this.#clear();
    void this.#exitPassThrough();
    if (owner === this) owner = null;
  }

  destroy(): void {
    this.#stopped = true;
    this.#clear();
    if (this.#passingThrough) void this.#exitPassThrough();
    if (owner === this) owner = null;
  }

  #schedule(): void {
    this.#clear();
    if (this.#stopped) return;
    this.#timer = setTimeout(() => void this.#poll(), POLL_MS);
  }

  async #poll(): Promise<void> {
    if (!this.#alive()) return;

    const inside = await this.#cursorOverHotspot();

    // Re-check after the await. The user can unlock mid-poll, and a stale
    // result resolving afterwards would switch click-through back on with no
    // lock state to justify it, stranding the window.
    if (!this.#alive()) return;

    this.#ticks++;
    const changed = inside !== this.hot;
    const shouldReassert = this.#ticks % REASSERT_EVERY === 0;

    if (changed || shouldReassert) {
      this.hot = inside;
      // Let clicks in only while the cursor is actually over the padlock.
      this.#passingThrough = !inside;
      await setClickThrough(!inside);
    }

    this.#schedule();
  }

  /** False once this controller has been stopped, unlocked, or superseded. */
  #alive(): boolean {
    if (this.#stopped || !this.locked) return false;
    if (owner !== this) {
      this.#stopped = true;
      return false;
    }
    return true;
  }

  async #cursorOverHotspot(): Promise<boolean> {
    if (!this.#hotspot) return false;

    const geometry = await this.#readGeometry();
    if (!geometry) return false;

    const cursor = await readCursor();
    if (!cursor) return false;

    // getBoundingClientRect is in CSS pixels relative to the window's client
    // area; the cursor is in physical pixels relative to the desktop. Scale the
    // rect and offset it by the window origin to compare the two.
    const rect = this.#hotspot.getBoundingClientRect();
    const { x, y, scale } = geometry;
    const pad = HOTSPOT_PADDING_PX * scale;

    const left = x + rect.left * scale - pad;
    const top = y + rect.top * scale - pad;
    const right = x + rect.right * scale + pad;
    const bottom = y + rect.bottom * scale + pad;

    return (
      cursor.x >= left &&
      cursor.x <= right &&
      cursor.y >= top &&
      cursor.y <= bottom
    );
  }

  async #readGeometry(): Promise<Geometry | null> {
    const now = Date.now();
    if (this.#geometry && now - this.#geometryAt < GEOMETRY_TTL_MS) {
      return this.#geometry;
    }

    const geometry = await readGeometry();
    if (geometry) {
      this.#geometry = geometry;
      this.#geometryAt = now;
    }
    return geometry;
  }

  // The flag records intent, so it is set before awaiting rather than after:
  // destroy() may run while one of these is still in flight, and it needs to
  // know whether the window is meant to be passing clicks through.
  async #enterPassThrough(): Promise<void> {
    this.#passingThrough = true;
    await setClickThrough(true);
  }

  async #exitPassThrough(): Promise<void> {
    this.#passingThrough = false;
    await setClickThrough(false);
  }

  #clear(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}
