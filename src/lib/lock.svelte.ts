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

  /** Registers the element whose bounds stay clickable while locked. */
  attach(element: HTMLElement | null): void {
    this.#hotspot = element;
  }

  toggle(): void {
    this.locked ? this.unlock() : this.lock();
  }

  lock(): void {
    if (this.locked) return;
    this.locked = true;
    this.#stopped = false;
    this.#geometry = null;
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
  }

  destroy(): void {
    this.#stopped = true;
    this.#clear();
    if (this.#passingThrough) void this.#exitPassThrough();
  }

  #schedule(): void {
    this.#clear();
    if (this.#stopped) return;
    this.#timer = setTimeout(() => void this.#poll(), POLL_MS);
  }

  async #poll(): Promise<void> {
    if (this.#stopped || !this.locked) return;

    const inside = await this.#cursorOverHotspot();

    if (inside !== this.hot) {
      this.hot = inside;
      // Let clicks in only while the cursor is actually over the padlock.
      await setClickThrough(!inside);
      this.#passingThrough = !inside;
    }

    this.#schedule();
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

  async #enterPassThrough(): Promise<void> {
    await setClickThrough(true);
    this.#passingThrough = true;
  }

  async #exitPassThrough(): Promise<void> {
    await setClickThrough(false);
    this.#passingThrough = false;
  }

  #clear(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}
