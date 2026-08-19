import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timer } from "./timer.svelte";
import type { Segment, TimerConfig } from "./plan";

/**
 * The timer engine's rules.
 *
 * `plan.ts` already covers what a run contains. What is left here is what
 * happens to a run as it is driven: paused, resumed, skipped, reset, and
 * reconfigured half way through. It is the same argument that justified the
 * plan tests — this is where being wrong is invisible. A misplaced button is
 * obvious; a pause that quietly loses forty seconds is not, and neither is a
 * transition that announces itself twice.
 *
 * Fake timers throughout, which also fake the clock — and faking the clock is
 * the only way to test a countdown that deliberately reads one.
 */

const config = (over: Partial<TimerConfig> = {}): TimerConfig => ({
  focusMinutes: 25,
  breakMinutes: 5,
  focusSessions: 3,
  ...over,
});

/** Short segments, so a whole run fits in a few simulated minutes. */
const quick = (focusSessions = 3): TimerConfig =>
  config({ focusMinutes: 1, breakMinutes: 1, focusSessions });

const MINUTE = 60_000;

let timer: Timer;

beforeEach(() => {
  vi.useFakeTimers();
  timer = new Timer();
});

afterEach(() => {
  timer.destroy();
  vi.useRealTimers();
});

describe("counting down", () => {
  // The one decision the whole engine rests on. Browsers throttle timers in a
  // window nobody is looking at, so the number of ticks that have run says
  // nothing about how much time has passed; the clock does.
  it("counts against a deadline rather than accumulating ticks", () => {
    timer.applyConfig(config({ focusMinutes: 10, focusSessions: 1 }));
    const started = Date.now();
    timer.start();

    // Two minutes go by without a single tick being allowed to run.
    vi.setSystemTime(started + 2 * MINUTE);
    vi.advanceTimersByTime(100);

    expect(timer.remainingMs).toBe(10 * MINUTE - (Date.now() - started));
  });

  it("never reports a negative remainder", () => {
    timer.applyConfig(quick(1));
    timer.start();
    vi.advanceTimersByTime(10 * MINUTE);

    expect(timer.remainingMs).toBeGreaterThanOrEqual(0);
  });
});

describe("pausing", () => {
  /**
   * Deliberately not a whole number of ticks.
   *
   * Pausing exactly on the 100ms grid proves nothing: the tick that just ran
   * has already written the right number, so a pause that captured nothing
   * would look correct. The fifty milliseconds are the whole test.
   */
  const OFF_GRID = MINUTE + 50;

  it("keeps what was left, to the millisecond", () => {
    timer.applyConfig(config({ focusMinutes: 10, focusSessions: 1 }));
    timer.start();
    vi.advanceTimersByTime(OFF_GRID);
    timer.pause();

    expect(timer.remainingMs).toBe(10 * MINUTE - OFF_GRID);
  });

  // A paused timer that keeps draining is the bug this guards: the deadline
  // is in the past by the time anyone comes back to it.
  it("stops the clock while it is paused", () => {
    timer.applyConfig(config({ focusMinutes: 10, focusSessions: 1 }));
    timer.start();
    vi.advanceTimersByTime(OFF_GRID);
    timer.pause();
    vi.advanceTimersByTime(30 * MINUTE);

    expect(timer.remainingMs).toBe(10 * MINUTE - OFF_GRID);
  });

  it("resumes from where it stopped rather than from where it would have been", () => {
    timer.applyConfig(config({ focusMinutes: 10, focusSessions: 1 }));
    timer.start();
    vi.advanceTimersByTime(OFF_GRID);
    timer.pause();
    vi.advanceTimersByTime(30 * MINUTE);
    timer.start();
    vi.advanceTimersByTime(40_000);

    expect(timer.remainingMs).toBe(10 * MINUTE - OFF_GRID - 40_000);
  });

  it("does nothing when it is already paused", () => {
    timer.applyConfig(quick());
    timer.pause();

    expect(timer.running).toBe(false);
    expect(timer.atStart).toBe(true);
  });
});

describe("skipping", () => {
  it("moves to the next segment", () => {
    timer.applyConfig(quick());
    timer.skip();

    expect(timer.index).toBe(1);
    expect(timer.phase).toBe("break");
    expect(timer.remainingMs).toBe(MINUTE);
  });

  // Skipping is a way of moving through a run, not a way of starting or
  // stopping one. Whichever it was before, it still is afterwards.
  it.each([true, false])("leaves the run running: %s", (running) => {
    timer.applyConfig(quick());
    if (running) timer.start();
    timer.skip();

    expect(timer.running).toBe(running);
  });

  it("ends the run rather than falling off the end of the plan", () => {
    timer.applyConfig(quick(1));
    timer.start();
    timer.skip();

    expect(timer.finished).toBe(true);
    expect(timer.running).toBe(false);
    expect(timer.remainingMs).toBe(0);
  });

  it("leaves no clock running once it has ended the run", () => {
    timer.applyConfig(quick(1));
    timer.start();
    timer.skip();
    vi.advanceTimersByTime(30 * MINUTE);

    expect(timer.remainingMs).toBe(0);
    expect(timer.running).toBe(false);
  });
});

describe("resetting", () => {
  const states: [string, (t: Timer) => void][] = [
    ["a run that never started", () => {}],
    ["a running one", (t) => t.start()],
    [
      "one paused part way",
      (t) => {
        t.start();
        vi.advanceTimersByTime(30_000);
        t.pause();
      },
    ],
    ["one that has been skipped along", (t) => t.skip()],
    [
      "one that has finished",
      (t) => {
        t.start();
        vi.advanceTimersByTime(30 * MINUTE);
      },
    ],
  ];

  it.each(states)("returns to the beginning from %s", (_, put) => {
    timer.applyConfig(quick());
    put(timer);
    timer.reset();

    expect(timer.running).toBe(false);
    expect(timer.finished).toBe(false);
    expect(timer.index).toBe(0);
    expect(timer.phase).toBe("focus");
    expect(timer.remainingMs).toBe(MINUTE);
    expect(timer.atStart).toBe(true);
  });

  // The play button on a finished run has to mean "again", not "nothing".
  it("starts a finished run over rather than refusing", () => {
    timer.applyConfig(quick(1));
    timer.start();
    vi.advanceTimersByTime(30 * MINUTE);
    expect(timer.finished).toBe(true);

    timer.start();

    expect(timer.finished).toBe(false);
    expect(timer.running).toBe(true);
    expect(timer.index).toBe(0);
  });
});

describe("reconfiguring", () => {
  // A stale index is the failure that would not throw and would not look
  // wrong: it would quietly serve the wrong segment.
  it("cannot be left pointing outside its own plan", () => {
    timer.applyConfig(quick(8));
    timer.start();
    vi.advanceTimersByTime(6 * MINUTE);
    expect(timer.index).toBeGreaterThan(0);

    timer.applyConfig(quick(1));

    expect(timer.index).toBe(0);
    expect(timer.index).toBeLessThan(timer.plan.length);
    expect(timer.segment).toBeDefined();
  });

  it("rebuilds the plan it was given", () => {
    timer.applyConfig(quick(2));
    expect(timer.plan).toHaveLength(3);

    timer.applyConfig(quick(4));
    expect(timer.plan).toHaveLength(7);
  });
});

describe("the cycle dots", () => {
  // The dots read "session N of M". N going past M, or starting at zero, is
  // the kind of wrong that only shows up on an unusual session count.
  it.each([1, 2, 3, 5, 8])("stay within 1..%i for the whole run", (sessions) => {
    timer.applyConfig(quick(sessions));
    timer.start();

    const seen: number[] = [];
    for (let i = 0; i < 2 * sessions + 2; i++) {
      seen.push(timer.focusIndex);
      vi.advanceTimersByTime(MINUTE);
    }

    expect(Math.min(...seen)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...seen)).toBeLessThanOrEqual(sessions);
  });
});

describe("announcing segments", () => {
  const announce = (t: Timer): string[] => {
    const seen: string[] = [];
    t.onSegmentEnd = (done: Segment, next: Segment | null) => {
      seen.push(`${done.phase}→${next ? next.phase : "done"}`);
    };
    return seen;
  };

  // Every one of these is a sound the user hears. One too many is a chime out
  // of nowhere; one too few is a break that starts in silence.
  it("announces each segment once, in order, ending exactly once", () => {
    const seen = announce(timer);
    timer.applyConfig(quick(3));
    timer.start();
    vi.advanceTimersByTime(30 * MINUTE);

    expect(seen).toEqual([
      "focus→break",
      "break→focus",
      "focus→break",
      "break→focus",
      "focus→done",
    ]);
  });

  it.each([1, 2, 5])(
    "ends a run of %i sessions exactly once, however long it is left",
    (sessions) => {
      const seen = announce(timer);
      timer.applyConfig(quick(sessions));
      timer.start();
      vi.advanceTimersByTime(60 * MINUTE);

      expect(seen.filter((s) => s.endsWith("done"))).toHaveLength(1);
      expect(seen).toHaveLength(2 * sessions - 1);
      expect(timer.finished).toBe(true);
    }
  );

  // Manual moves are announced by the button that made them, not by the
  // engine: the phrases mean "the timer moved on by itself".
  it("says nothing when the user does the moving", () => {
    const seen = announce(timer);
    timer.applyConfig(quick(2));
    timer.skip();
    timer.reset();
    timer.start();
    timer.pause();

    expect(seen).toEqual([]);
  });
});

/**
 * What happens when nobody was looking.
 *
 * A minimised window has its timers throttled to once a second and then to
 * once a minute; a suspended machine does not run them at all. So a tick can
 * arrive long after the moment it was scheduled for, with several segments
 * having quietly run out in between — and the lid of a laptop closing mid
 * session guarantees it, which is why none of this needed measuring first.
 */
describe("time passing while the tick is starved", () => {
  /** Lets the clock jump without letting a single timer run. */
  const sleep = (ms: number): void => {
    vi.setSystemTime(Date.now() + ms);
  };

  it("lands in the segment that is actually current", () => {
    timer.applyConfig(quick(3));
    const started = Date.now();
    timer.start();

    // Three and a half minutes into a five minute run: focus, break, focus
    // have all gone, and the second break is half over.
    sleep(3.5 * MINUTE);
    vi.advanceTimersByTime(100);

    expect(timer.index).toBe(3);
    expect(timer.phase).toBe("break");
    expect(timer.remainingMs).toBe(4 * MINUTE - (Date.now() - started));
  });

  // The failure this replaces: the next segment used to begin from the moment
  // the tick noticed, so every interruption silently lengthened the run by
  // however long the interruption had been.
  it("starts each segment when the one before it ended, not when it was noticed", () => {
    timer.applyConfig(quick(3));
    const started = Date.now();
    timer.start();

    sleep(90_000);
    vi.advanceTimersByTime(100);

    expect(timer.index).toBe(1);
    expect(timer.remainingMs).toBe(2 * MINUTE - (Date.now() - started));
  });

  it("ends a run that finished while it was asleep", () => {
    timer.applyConfig(quick(3));
    timer.start();

    sleep(60 * MINUTE);
    vi.advanceTimersByTime(100);

    expect(timer.finished).toBe(true);
    expect(timer.running).toBe(false);
    expect(timer.remainingMs).toBe(0);
  });

  // Four chimes at once, on opening a laptop, would be an alarm going off
  // about the past. The sounds mean "the timer has moved on"; being told four
  // times is not four times as informative.
  it("announces once, for where it arrived", () => {
    const seen: string[] = [];
    timer.onSegmentEnd = (done, next) =>
      seen.push(`${done.phase}→${next ? next.phase : "done"}`);

    timer.applyConfig(quick(3));
    timer.start();
    sleep(3.5 * MINUTE);
    vi.advanceTimersByTime(100);

    expect(seen).toEqual(["focus→break"]);
  });

  it("announces the end once, however far past it slept", () => {
    const seen: string[] = [];
    timer.onSegmentEnd = (done, next) =>
      seen.push(`${done.phase}→${next ? next.phase : "done"}`);

    timer.applyConfig(quick(3));
    timer.start();
    sleep(60 * MINUTE);
    vi.advanceTimersByTime(100);

    expect(seen).toEqual(["focus→done"]);
  });

  describe("catchUp", () => {
    it("straightens the run out without waiting for a tick", () => {
      timer.applyConfig(quick(3));
      const started = Date.now();
      timer.start();

      sleep(3.5 * MINUTE);
      timer.catchUp();

      expect(timer.index).toBe(3);
      expect(timer.remainingMs).toBe(4 * MINUTE - (Date.now() - started));
    });

    it("leaves a paused run alone", () => {
      timer.applyConfig(quick(3));
      timer.start();
      vi.advanceTimersByTime(30_000);
      timer.pause();
      const left = timer.remainingMs;

      sleep(30 * MINUTE);
      timer.catchUp();

      expect(timer.remainingMs).toBe(left);
      expect(timer.index).toBe(0);
    });

    it("does nothing to a run that has not been started", () => {
      timer.applyConfig(quick(3));

      timer.catchUp();

      expect(timer.atStart).toBe(true);
    });
  });
});

describe("destroy", () => {
  // The widget is meant to sit open all day. A clock that keeps ticking after
  // the thing that owned it has gone is the classic way that stops being true.
  it("stops the clock", () => {
    timer.applyConfig(config({ focusMinutes: 10, focusSessions: 1 }));
    timer.start();
    vi.advanceTimersByTime(MINUTE);
    const left = timer.remainingMs;

    timer.destroy();
    vi.advanceTimersByTime(5 * MINUTE);

    expect(timer.remainingMs).toBe(left);
  });
});
