/**
 * Widget scale.
 *
 * One number multiplies every size in the app, via the `--scale` custom
 * property that `app.css` turns into the root font size. This is a separate
 * axis from compact mode, which changes *which* elements exist, and from the
 * disclosure panels planned later, which change *how much content* there is.
 * Keeping the three apart means a control for one never has side effects on
 * the others.
 */

export const MIN_SCALE = 0.8;
export const MAX_SCALE = 1.8;
export const SCALE_STEP = 0.05;

const clamp = (value: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

export class ScaleController {
  value = $state(1);
  dragging = $state(false);

  #startX = 0;
  #startValue = 1;
  #baseWidth = 1;

  /**
   * @param baseWidth width of the current layout at scale 1, so that dragging
   *   one screen pixel changes the widget by one pixel — the most predictable
   *   mapping available.
   */
  begin(event: PointerEvent, baseWidth: number): void {
    // screenX rather than clientX: the window resizes underneath the cursor as
    // we drag, which would make any window-relative coordinate drift.
    this.#startX = event.screenX;
    this.#startValue = this.value;
    this.#baseWidth = Math.max(1, baseWidth);
    this.dragging = true;

    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture(event.pointerId);
  }

  move(event: PointerEvent): void {
    if (!this.dragging) return;
    const delta = event.screenX - this.#startX;
    const width = this.#baseWidth * this.#startValue + delta;
    this.set(width / this.#baseWidth);
  }

  end(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;

    const target = event.currentTarget as HTMLElement | null;
    if (target?.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  set(next: number): void {
    // Two decimals keeps the persisted value tidy and avoids re-rendering on
    // sub-perceptual changes.
    this.value = clamp(Math.round(next * 100) / 100);
  }

  nudge(delta: number): void {
    this.set(this.value + delta);
  }

  reset(): void {
    this.set(1);
  }
}
