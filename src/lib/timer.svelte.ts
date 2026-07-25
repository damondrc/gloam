/**
 * The timer engine.
 *
 * Two design decisions worth noting:
 *
 * 1. Countdown is derived from an absolute end timestamp, never from
 *    accumulating tick deltas. Browsers throttle timers in backgrounded or
 *    occluded windows, and this widget is meant to sit unattended on a second
 *    screen for half an hour at a time. Accumulating would drift; comparing
 *    against `Date.now()` cannot.
 *
 * 2. Breaks are placed *between* focus sessions, never after the last one.
 *    A trailing break has nothing to resume into, so it is dead time.
 */

export type Phase = "focus" | "break";

export interface Segment {
  phase: Phase;
  durationMs: number;
}

export interface TimerConfig {
  focusMinutes: number;
  breakMinutes: number;
  /** How many focus sessions make up one full run. */
  focusSessions: number;
}

export const DEFAULT_CONFIG: TimerConfig = {
  focusMinutes: 30,
  breakMinutes: 10,
  focusSessions: 2,
};

/** Expands a config into the flat list of segments to run, in order. */
export function buildPlan(config: TimerConfig): Segment[] {
  const plan: Segment[] = [];
  const sessions = Math.max(1, Math.floor(config.focusSessions));

  for (let i = 0; i < sessions; i++) {
    if (i > 0) {
      plan.push({ phase: "break", durationMs: config.breakMinutes * 60_000 });
    }
    plan.push({ phase: "focus", durationMs: config.focusMinutes * 60_000 });
  }
  return plan;
}

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

  /** mm:ss, rounding up so the display never shows 00:00 while still running. */
  display = $derived.by(() => {
    const totalSeconds = Math.max(0, Math.ceil(this.remainingMs / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  });

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

  #advance(): void {
    const done = this.plan[this.index];
    const nextIndex = this.index + 1;
    const next = this.plan[nextIndex] ?? null;

    this.onSegmentEnd?.(done, next);

    if (!next) {
      this.#clearTick();
      this.running = false;
      this.finished = true;
      return;
    }

    this.index = nextIndex;
    this.remainingMs = next.durationMs;
    this.#endsAt = Date.now() + next.durationMs;
    this.#scheduleTick();
  }

  #clearTick(): void {
    if (this.#timeout !== null) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }
}
