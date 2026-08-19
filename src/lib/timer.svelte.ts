/**
 * The timer engine: the reactive half.
 *
 * The rules about what a run contains and how a duration reads live in
 * `plan.ts`, which is plain TypeScript and therefore testable. What is left
 * here is the part that genuinely needs reactivity — the state a component
 * subscribes to, and the clock that advances it.
 *
 * One decision worth keeping in view: the countdown is derived from an
 * absolute end timestamp, never from accumulating tick deltas. Browsers
 * throttle timers in backgrounded or occluded windows, and this widget is
 * meant to sit unattended for half an hour at a time. Accumulating would
 * drift; comparing against `Date.now()` cannot.
 */

import { buildPlan, DEFAULT_CONFIG, formatDuration } from "./plan";
import type { Phase, Segment, TimerConfig } from "./plan";

export { buildPlan, DEFAULT_CONFIG, formatDuration };
export type { Phase, Segment, TimerConfig };

const TICK_MS = 100;

export class Timer {
  config = $state<TimerConfig>({ ...DEFAULT_CONFIG });
  index = $state(0);
  running = $state(false);
  finished = $state(false);
  remainingMs = $state(DEFAULT_CONFIG.focusMinutes * 60_000);

  /** Fired when a segment runs out. `next` is null when the whole run is over. */
  onSegmentEnd: ((done: Segment, next: Segment | null) => void) | null = null;

  #endsAt = 0;
  #timeout: ReturnType<typeof setTimeout> | null = null;

  plan = $derived(buildPlan(this.config));

  segment = $derived.by<Segment>(
    () => this.plan[this.index] ?? this.plan[this.plan.length - 1]
  );

  phase = $derived.by<Phase>(() => this.segment.phase);

  /** 0 at the start of the current segment, 1 at its end. */
  progress = $derived.by(() => {
    const total = this.segment.durationMs;
    if (total <= 0) return 1;
    const done = 1 - this.remainingMs / total;
    return Math.min(1, Math.max(0, done));
  });

  /** Which focus session we are on, 1-indexed, for the cycle dots. */
  focusIndex = $derived.by(() => {
    let n = 0;
    for (let i = 0; i <= this.index && i < this.plan.length; i++) {
      if (this.plan[i].phase === "focus") n++;
    }
    return Math.max(1, n);
  });

  label = $derived.by(() => {
    if (this.finished) return "DONE";
    return this.phase === "focus" ? "FOCUS" : "BREAK";
  });

  display = $derived(formatDuration(this.remainingMs));

  /**
   * True when nothing would be lost by rebuilding the plan: the run is stopped
   * on its first segment with none of it spent.
   */
  atStart = $derived(
    !this.running &&
      !this.finished &&
      this.index === 0 &&
      this.remainingMs === this.plan[0].durationMs
  );

  start(): void {
    if (this.finished) this.reset();
    if (this.running) return;

    this.#endsAt = Date.now() + this.remainingMs;
    this.running = true;
    this.#scheduleTick();
  }

  pause(): void {
    if (!this.running) return;
    this.remainingMs = Math.max(0, this.#endsAt - Date.now());
    this.running = false;
    this.#clearTick();
  }

  toggle(): void {
    this.running ? this.pause() : this.start();
  }

  /** Back to the very beginning of the run, stopped. */
  reset(): void {
    this.#clearTick();
    this.running = false;
    this.finished = false;
    this.index = 0;
    this.remainingMs = this.plan[0].durationMs;
  }

  /** Jump to the next segment, keeping the running/paused state. */
  skip(): void {
    const nextIndex = this.index + 1;
    if (nextIndex >= this.plan.length) {
      this.#clearTick();
      this.running = false;
      this.finished = true;
      this.remainingMs = 0;
      return;
    }
    this.index = nextIndex;
    this.remainingMs = this.plan[nextIndex].durationMs;
    if (this.running) this.#endsAt = Date.now() + this.remainingMs;
  }

  /** Re-apply a config change without losing the current position if possible. */
  applyConfig(next: TimerConfig): void {
    this.config = { ...next };
    this.reset();
  }

  /**
   * Re-read the clock now instead of waiting for the next tick.
   *
   * Called when the window becomes visible again. Nothing depends on it —
   * `#advance` will straighten the run out whenever the tick eventually fires,
   * and it does not care how late that is. What this buys is that the widget
   * is already right at the moment you look at it, rather than right a moment
   * afterwards, and a readout that corrects itself while you watch reads as a
   * clock that was wrong.
   */
  catchUp(): void {
    if (!this.running) return;
    this.#tick();
  }

  destroy(): void {
    this.#clearTick();
  }

  #scheduleTick(): void {
    this.#clearTick();
    this.#timeout = setTimeout(() => this.#tick(), TICK_MS);
  }

  #tick(): void {
    if (!this.running) return;

    const left = this.#endsAt - Date.now();
    if (left > 0) {
      this.remainingMs = left;
      this.#scheduleTick();
      return;
    }

    this.remainingMs = 0;
    this.#advance();
  }

  /**
   * Move on from a segment whose time has run out — possibly by more than one.
   *
   * A tick can arrive long after the moment it was scheduled for. Browsers
   * throttle the timers of a window nobody is looking at, first to once a
   * second and then to once a minute; a suspended machine does not run them at
   * all. Closing a laptop lid mid-session is the case that guarantees it, and
   * needs no measurement to believe.
   *
   * So this walks forward rather than stepping once. Two things make the walk
   * correct:
   *
   * Each segment starts when the one before it ended, not when the tick that
   * noticed happened to run — `#endsAt` accumulates durations rather than
   * being reset from `Date.now()`. Otherwise every interruption would silently
   * lengthen the run by however long the interruption was.
   *
   * And however many boundaries were crossed, only one is announced: the one
   * that landed you where you are. The transition sounds mean "the timer has
   * moved on", and four of them in a row after opening a laptop would be an
   * alarm going off about the past.
   */
  #advance(): void {
    const now = Date.now();
    let done = this.plan[this.index];

    for (;;) {
      const next = this.plan[this.index + 1] ?? null;

      if (!next) {
        this.#clearTick();
        this.running = false;
        this.finished = true;
        this.remainingMs = 0;
        this.onSegmentEnd?.(done, null);
        return;
      }

      this.#endsAt += next.durationMs;
      this.index += 1;

      if (this.#endsAt > now) {
        this.remainingMs = this.#endsAt - now;
        this.#scheduleTick();
        this.onSegmentEnd?.(done, next);
        return;
      }

      // That one is over too. Keep walking, remembering what we last left.
      done = next;
    }
  }

  #clearTick(): void {
    if (this.#timeout !== null) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }
}
