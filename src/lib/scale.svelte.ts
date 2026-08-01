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
  #startY = 0;
  #startValue = 1;
  #baseWidth = 1;
  #baseHeight = 1;

  /**
   * @param baseWidth  width of the current layout at scale 1
   * @param baseHeight height of the current layout at scale 1
   */
  begin(event: PointerEvent, baseWidth: number, baseHeight: number): void {
    // Screen coordinates rather than client ones: the window resizes
    // underneath the cursor as we drag, which would make any window-relative
    // coordinate drift.
    this.#startX = event.screenX;
    this.#startY = event.screenY;
    this.#startValue = this.value;
    this.#baseWidth = Math.max(1, baseWidth);
    this.#baseHeight = Math.max(1, baseHeight);
    this.dragging = true;

    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture(event.pointerId);
  }

  move(event: PointerEvent): void {
    if (!this.dragging) return;

    const dx = event.screenX - this.#startX;
    const dy = event.screenY - this.#startY;
    const w = this.#baseWidth;
    const h = this.#baseHeight;

    // The widget's proportions are fixed, so the corner can only travel along
    // one line: as the scale grows by ds the grip moves by (w·ds, h·ds).
    // Projecting the pointer's travel onto that line is the closest the corner
    // can stay to the cursor, and it means both axes contribute — dragging
    // down enlarges as naturally as dragging right, and a diagonal drag reads
    // as one gesture rather than only its horizontal half.
    const delta = (dx * w + dy * h) / (w * w + h * h);

    this.set(this.#startValue + delta);
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
