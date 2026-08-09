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
   * The flapping is driven from here rather than by a CSS animation, because
   * small birds do not flap steadily. They fly in bursts and then glide, losing
   * a little height each glide and regaining it on the next burst — which is
   * why a sparrow's path undulates instead of running straight. A fixed
   * animation duration cannot vary its own rate or hold a pose, so the frame
   * index is computed instead. The loop only exists for the fifteen seconds a
   * crossing lasts.
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
   * each burst varies again, so no two are ever quite in step.
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
   * Design pixels per millisecond, and the range height wanders over.
   *
   * Flapping lifts and gliding sinks, so these move `altitude` in opposite
   * directions — and since the Y axis points down, lifting means subtracting.
   *
   * Barely more than half a pixel either way, and slow enough to spread across
   * a whole glide rather than saturating in its first moment. Once glides run
   * to several seconds a visible sink stops reading as a bird coasting and
   * starts reading as one losing the fight, so what is left here is just enough
   * to keep the path from being a ruled line.
   */
  const CLIMB = 0.0003;
  const SINK = 0.00035;
  const ALTITUDE = 0.6;

  /**
   * How far ahead or behind its place in the formation a bird ends up. Applied
   * across the whole crossing, so the extremes are this far apart twice over —
   * enough that the shape of the group visibly changes on the way, without it
   * coming apart.
   */
  const LEAD = 7;

  /**
   * Surge: how far a bird runs ahead of its own drift, and how fast.
   *
   * The drift above is linear, which spreads its whole effect across sixteen
   * seconds and therefore amounts to under a pixel per second — visible by
   * comparing the two ends of a crossing, invisible at any instant. This is the
   * part you actually see, and it has a physical reason: a bird gains ground
   * while it beats and gives some back while it coasts. Since no two are in
   * step, they are forever passing each other.
   */
  const SURGE = 3;
  const SURGE_GAIN = 0.0013;
  const SURGE_LOSS = 0.0015;

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
  const DEPTH_SPAN = (LOWEST - HIGHEST) / 100 + 26 / STAGE;

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
    /** How far ahead or behind its place this one drifts by the far side. */
    lead: number;
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
    count: number;
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

      const sims: Sim[] = Array.from({ length: count }, () => {
        const sim: Sim = {
          mode: "flap",
          cycle: 0,
          period: base,
          beatsLeft: 0,
          glideLeft: 0,
          altitude: between(-ALTITUDE, ALTITUDE),
          surge: between(-SURGE, SURGE),
          lead: between(-LEAD, LEAD),
        };
        restBurst(sim, base * between(0.9, 1.12));
        // Start mid-beat, so the flock does not enter in unison.
        sim.cycle = Math.random() * sim.period;
        return sim;
      });

      const top = between(HIGHEST, LOWEST);

      flight = {
        id: id++,
        top,
        // Usually descending, occasionally not, so the path is never the same
        // line twice.
        drift: between(-6, 16),
        durationMs,
        count,
      };

      const started = performance.now();
      let last = started;

      const step = (now: number): void => {
        const dt = Math.min(now - last, 100);
        last = now;
        const progress = Math.min(1, (now - started) / durationMs);

        views = sims.map((sim, i) => {
          advance(sim, base, dt);
          const phase = sim.cycle / sim.period;
          const y =
            FORMATION[i].y +
            sim.altitude +
            (sim.mode === "glide" ? 0 : Math.cos(phase * Math.PI * 2) * BOB);

          // How far down the sky this bird actually is, counting the flock's
          // band and its own place within the formation.
          const depth = Math.min(
            1,
            Math.max(0, (top / 100 + y / STAGE - HIGHEST / 100) / DEPTH_SPAN)
          );

          return {
            frame: sim.mode === "glide" ? GLIDE_FRAME : Math.floor(phase * 12) % 12,
            // Centred on the formation: the group is in its designed shape
            // halfway across and stretches gently either side of that.
            x: FORMATION[i].x + sim.lead * (progress * 2 - 1) + sim.surge,
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
    width: calc(56px * var(--ambient));
    height: calc(42px * var(--ambient));
    color: rgb(var(--ground));
    pointer-events: none;
    animation-name: cross;
    animation-timing-function: linear;
    animation-fill-mode: both;
    will-change: transform;
  }

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
      transform: translate(calc(-60px * var(--ambient)), var(--drift));
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
