<script lang="ts">
  /**
   * A flock, crossing once in a long while.
   *
   * This is the other half of the rule the clouds follow. Continuous motion has
   * to be too slow to notice; anything fast has to be rare. A flock is fast
   * enough to trip the movement detection peripheral vision is built for, so
   * the only way it does not steal attention is by almost never happening.
   * Rarity is the mechanism rather than a limitation: caught once a session by
   * accident, it reads as a small gift instead of noise.
   *
   * Everything below exists to make that moment worth catching, and it comes
   * down to one thing: the birds have to behave like individuals that happen to
   * be travelling together, not like a shape being dragged across the screen.
   * They flap at their own rates, glide at their own times, wander within the
   * group, and pass in front of and behind each other.
   *
   * The animation is driven from here rather than by CSS, because none of that
   * can be expressed as a fixed duration.
   */
  import { BIRD_BODY, BIRD_FRAMES, BIRD_VIEWBOX } from "./birdFrames";

  interface Props {
    /** 0..1 from the sky state. Nothing flies after dark. */
    visible: number;
  }

  let { visible }: Props = $props();

  const GAP_MIN_MS = 240_000;
  const GAP_MAX_MS = 540_000;

  /**
   * Development only. Waiting four minutes between crossings makes the flight
   * impossible to judge, so under `npm run app` they come every few seconds.
   * Vite resolves import.meta.env.DEV at build time and strips the branch, so
   * this cannot reach a release however forgetful anyone is.
   */
  const DEV_GAP_MS = 5_000;

  const FLIGHT_MIN_MS = 14_000;
  const FLIGHT_MAX_MS = 19_000;

  /**
   * Wingbeat, tied to ground speed rather than picked independently: a bird
   * crossing faster is beating harder. Each bird then varies around it, and
   * each burst varies again.
   */
  const FLAP_FAST_MS = 730;
  const FLAP_SLOW_MS = 850;

  /** How many beats before a bird takes a rest, and how long the rest lasts. */
  const BEATS_MIN = 3;
  const BEATS_MAX = 7;
  const GLIDE_MIN_MS = 900;
  const GLIDE_MAX_MS = 3_800;

  /**
   * Mid-downstroke, where the wing is fully extended and roughly level — the
   * pose a bird holds when it stops working and coasts.
   */
  const GLIDE_FRAME = 2;

  /**
   * Design pixels per millisecond, and the range height wanders over while
   * beating and coasting. Flapping lifts and gliding sinks, and since the Y
   * axis points down, lifting means subtracting.
   *
   * Barely more than half a pixel either way. Once glides run to several
   * seconds a visible sink stops reading as a bird coasting and starts reading
   * as one losing the fight.
   */
  const CLIMB = 0.0003;
  const SINK = 0.00035;
  const ALTITUDE = 0.6;

  /**
   * Ground gained while beating and given back while coasting. This is the
   * short-term jostling, on the timescale of a wingbeat.
   */
  const SURGE = 3;
  const SURGE_GAIN = 0.0013;
  const SURGE_LOSS = 0.0015;

  /**
   * Wander: the slow shuffling of places within the flock.
   *
   * This replaced a linear drift, which could not do the job however far it was
   * pushed. Spread evenly across a crossing it amounted to under a pixel per
   * second — invisible at any instant — and being monotonic it preserved the
   * order the birds set out in, so the flock arrived arranged as it departed.
   *
   * Two sines of unrelated periods per bird instead. They move back and forth
   * within the group rather than away from it, so two birds in opposite phase
   * separate by twice the amplitude — more than the spacing between
   * neighbours — which is what lets them genuinely overtake. Two rather than
   * one because a single sine is a pendulum, and pendulums read as machinery.
   *
   * What bounds these is not how far but how fast. The flock covers about 26
   * design pixels a second, and a sine's peak speed is 2π·amplitude/period, so
   * an amplitude of 10 over five seconds is 12 px/s — nearly half the crossing
   * speed. An earlier pair summed to more than 26 between them, at which point
   * a bird stops dead against the screen or slides backwards while still
   * beating its wings. Long periods and small amplitudes keep the wander to
   * something under a fifth of the ground speed: a bird leaves its place and
   * returns about once per crossing, which is all it takes to read as alive.
   */
  const WANDER_MAJOR = 8;
  const WANDER_MINOR = 3.5;
  const WANDER_LIFT = 3.5;

  /**
   * The band a flock may cross in, as a percentage down the stage, and the
   * apparent size at the top of it against the bottom. Birds keep to the upper
   * sky — they do not skim the horizon — and the ones lower in the frame are
   * further off, so they are drawn smaller. The formation's own height feeds
   * the same calculation, which gives the group depth as well as the crossing.
   */
  const HIGHEST = 5;
  const LOWEST = 24;
  const NEAR = 1.2;
  const FAR = 0.76;

  /** Stage height in design pixels, for turning an offset into a depth. */
  const STAGE = 132;
  const DEPTH_SPAN = (LOWEST - HIGHEST) / 100 + 30 / STAGE;

  const COUNT_MIN = 4;
  const COUNT_MAX = 7;

  /**
   * Wingspan and body bob, in design pixels at 100%. These are multiplied by
   * `--ambient` rather than expressed in rem: the flock scales with the widget,
   * but only partly, so growing the window reads as more sky rather than
   * larger birds.
   */
  const SIZE = 10;
  const BOB = 0.7;

  /** Loose and uneven: a tidy V reads as a logo rather than birds. */
  const FORMATION = [
    { x: 0, y: 0 },
    { x: 14, y: 6 },
    { x: 28, y: 1 },
    { x: 10, y: 14 },
    { x: 24, y: 17 },
    { x: 38, y: 8 },
    { x: 5, y: 25 },
  ];

  const between = (min: number, max: number): number =>
    min + Math.random() * (max - min);

  interface Wave {
    amp: number;
    periodMs: number;
    phase: number;
  }

  const wave = (amp: number, minMs: number, maxMs: number): Wave => ({
    amp: amp * between(0.55, 1),
    periodMs: between(minMs, maxMs),
    phase: Math.random() * Math.PI * 2,
  });

  const sample = (w: Wave, t: number): number =>
    w.amp * Math.sin((t / w.periodMs) * Math.PI * 2 + w.phase);

  /** What a bird is doing right now. Mutated in place by the loop. */
  interface Sim {
    mode: "flap" | "glide";
    /** Milliseconds into the current wingbeat. */
    cycle: number;
    period: number;
    beatsLeft: number;
    glideLeft: number;
    /** Height wandered from the formation line, in design pixels. */
    altitude: number;
    /** Ground gained while beating, given back while coasting. */
    surge: number;
    /** Two sideways sines and one vertical, all of unrelated periods. */
    wanderA: Wave;
    wanderB: Wave;
    wanderY: Wave;
  }

  /** What the markup reads. Replaced wholesale each frame. */
  interface View {
    frame: number;
    x: number;
    y: number;
    /** Apparent size, from how high in the frame this one is flying. */
    scale: number;
  }

  interface Flight {
    /** Restarting the crossing animation needs a fresh key. */
    id: number;
    top: number;
    drift: number;
    durationMs: number;
  }

  let flight = $state<Flight | null>(null);
  let views = $state<View[]>([]);

  function restBurst(sim: Sim, base: number): void {
    sim.mode = "flap";
    sim.beatsLeft = Math.round(between(BEATS_MIN, BEATS_MAX));
    // Each burst is its own tempo, so even one bird is never metronomic.
    sim.period = base * between(0.82, 1.2);
    sim.cycle = 0;
  }

  function advance(sim: Sim, base: number, dt: number): void {
    if (sim.mode === "flap") {
      sim.cycle += dt;
      sim.altitude = Math.max(-ALTITUDE, sim.altitude - dt * CLIMB);
      sim.surge = Math.max(-SURGE, sim.surge - dt * SURGE_GAIN);

      while (sim.cycle >= sim.period) {
        sim.cycle -= sim.period;
        sim.beatsLeft -= 1;
        if (sim.beatsLeft <= 0) {
          sim.mode = "glide";
          sim.glideLeft = between(GLIDE_MIN_MS, GLIDE_MAX_MS);
          break;
        }
      }
      return;
    }

    sim.glideLeft -= dt;
    sim.altitude = Math.min(ALTITUDE, sim.altitude + dt * SINK);
    sim.surge = Math.min(SURGE, sim.surge + dt * SURGE_LOSS);
    if (sim.glideLeft <= 0) restBurst(sim, base);
  }

  $effect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let raf = 0;
    let id = 0;

    const gap = (): number =>
      import.meta.env.DEV ? DEV_GAP_MS : between(GAP_MIN_MS, GAP_MAX_MS);

    const land = (): void => {
      cancelAnimationFrame(raf);
      flight = null;
      views = [];
      timer = setTimeout(depart, gap());
    };

    const depart = (): void => {
      const durationMs = between(FLIGHT_MIN_MS, FLIGHT_MAX_MS);
      const speed = (durationMs - FLIGHT_MIN_MS) / (FLIGHT_MAX_MS - FLIGHT_MIN_MS);
      const base = FLAP_FAST_MS + (FLAP_SLOW_MS - FLAP_FAST_MS) * speed;
      const count = Math.round(between(COUNT_MIN, COUNT_MAX));
      const top = between(HIGHEST, LOWEST);

      const sims: Sim[] = Array.from({ length: count }, () => {
        const sim: Sim = {
          mode: "flap",
          cycle: 0,
          period: base,
          beatsLeft: 0,
          glideLeft: 0,
          altitude: between(-ALTITUDE, ALTITUDE),
          surge: between(-SURGE, SURGE),
          wanderA: wave(WANDER_MAJOR, 9_000, 14_000),
          wanderB: wave(WANDER_MINOR, 6_000, 9_000),
          wanderY: wave(WANDER_LIFT, 7_000, 12_000),
        };
        restBurst(sim, base * between(0.9, 1.12));
        // Start mid-beat, so the flock does not enter in unison.
        sim.cycle = Math.random() * sim.period;
        return sim;
      });

      flight = {
        id: id++,
        top,
        // Usually descending, occasionally not, so the path is never the same
        // line twice.
        drift: between(-6, 16),
        durationMs,
      };

      const started = performance.now();
      let last = started;

      const step = (now: number): void => {
        const dt = Math.min(now - last, 100);
        last = now;
        const elapsed = now - started;

        views = sims.map((sim, i) => {
          advance(sim, base, dt);
          const phase = sim.cycle / sim.period;

          const y =
            FORMATION[i].y +
            sim.altitude +
            sample(sim.wanderY, elapsed) +
            (sim.mode === "glide" ? 0 : Math.cos(phase * Math.PI * 2) * BOB);

          // How far down the sky this bird actually is, counting the flock's
          // band and its own place within the formation.
          const depth = Math.min(
            1,
            Math.max(0, (top / 100 + y / STAGE - HIGHEST / 100) / DEPTH_SPAN)
          );

          return {
            frame: sim.mode === "glide" ? GLIDE_FRAME : Math.floor(phase * 12) % 12,
            x:
              FORMATION[i].x +
              sample(sim.wanderA, elapsed) +
              sample(sim.wanderB, elapsed) +
              sim.surge,
            y,
            scale: NEAR + (FAR - NEAR) * depth,
          };
        });

        raf = requestAnimationFrame(step);
      };

      raf = requestAnimationFrame(step);
      timer = setTimeout(land, durationMs);
    };

    timer = setTimeout(depart, gap());

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  });
</script>

{#if flight}
  {#key flight.id}
    <div
      class="flock"
      style="
        top: {flight.top}%;
        --drift: {flight.drift}rem;
        opacity: {visible};
        animation-duration: {flight.durationMs}ms;
      "
      aria-hidden="true"
    >
      {#each views as view, i (i)}
        <span
          class="bird"
          style="
            transform: translate(
              calc({view.x.toFixed(2)}px * var(--ambient)),
              calc({view.y.toFixed(2)}px * var(--ambient))
            );
            width: calc({(SIZE * view.scale).toFixed(2)}px * var(--ambient));
            height: calc({((SIZE * view.scale * BIRD_VIEWBOX.height) / BIRD_VIEWBOX.width).toFixed(2)}px * var(--ambient));
            z-index: {Math.round(view.scale * 100)};
          "
        >
          <svg viewBox="0 0 {BIRD_VIEWBOX.width} {BIRD_VIEWBOX.height}">
            <path d={BIRD_FRAMES[view.frame].far} fill="currentColor" opacity="0.93" />
            <path d={BIRD_BODY} fill="currentColor" />
            <path d={BIRD_FRAMES[view.frame].near} fill="currentColor" />
          </svg>
        </span>
      {/each}
    </div>
  {/key}
{/if}

<style>
  .flock {
    position: absolute;
    left: 0;
    width: calc(80px * var(--ambient));
    height: calc(52px * var(--ambient));
    color: rgb(var(--ground));
    pointer-events: none;
    animation-name: cross;
    animation-timing-function: linear;
    animation-fill-mode: both;
    will-change: transform;
  }

  /* Stacked by apparent size, so a nearer bird passes in front of a further
     one. Overlapping is not a fault to be avoided — these are not on a plane,
     and two crossing paths only look like a collision from here. */
  .bird {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Enters and leaves well outside the frame, so neither end of the crossing
     is ever visible as an appearance. */
  @keyframes cross {
    from {
      transform: translate(calc(var(--frame-w) * 1rem), 0);
    }
    to {
      transform: translate(calc(-90px * var(--ambient)), var(--drift));
    }
  }

  /* Fast motion is precisely what this setting exists to suppress, so the
     flock does not fly at all. */
  @media (prefers-reduced-motion: reduce) {
    .flock {
      display: none;
    }
  }
</style>
