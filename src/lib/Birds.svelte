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
   * Each crossing rolls its own duration, flock size and height, so no two are
   * quite the same — a flight that repeated exactly would start to read as a
   * loop, which is the one thing that would give it away as decoration.
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
   * crossing faster is beating harder. Uncoupling them is a small thing that
   * the eye notices without being able to say why.
   */
  const FLAP_FAST_MS = 730;
  const FLAP_SLOW_MS = 850;

  const COUNT_MIN = 4;
  const COUNT_MAX = 6;

  /**
   * How far a bird may drift along the flock's line of travel, in design
   * pixels either side of its place in the formation.
   *
   * Birds keep company, not step. Flying the whole crossing in rigid formation
   * reads as one object with wings drawn on it; letting each one hold a
   * slightly different pace makes them individuals that happen to be
   * travelling together, and the shape of the group changes gently on the way
   * across. Small on purpose — enough to notice only if you watch for it.
   */
  const LEAD_MAX = 4;

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

  interface Flight {
    /** Restarting the animation needs a fresh key. */
    id: number;
    top: number;
    drift: number;
    durationMs: number;
    flapMs: number;
    count: number;
    /** One drift per bird, so no two crossings deform the same way. */
    leads: number[];
  }

  let flight = $state<Flight | null>(null);

  const between = (min: number, max: number): number =>
    min + Math.random() * (max - min);

  function roll(id: number): Flight {
    const durationMs = between(FLIGHT_MIN_MS, FLIGHT_MAX_MS);
    const speed = (durationMs - FLIGHT_MIN_MS) / (FLIGHT_MAX_MS - FLIGHT_MIN_MS);
    const count = Math.round(between(COUNT_MIN, COUNT_MAX));

    return {
      id,
      top: between(8, 32),
      // Usually descending, occasionally not, so the path is never the same
      // line twice.
      drift: between(-6, 16),
      durationMs,
      flapMs: FLAP_FAST_MS + (FLAP_SLOW_MS - FLAP_FAST_MS) * speed,
      count,
      leads: Array.from({ length: count }, () => between(-LEAD_MAX, LEAD_MAX)),
    };
  }

  $effect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let id = 0;

    const gap = (): number =>
      import.meta.env.DEV ? DEV_GAP_MS : between(GAP_MIN_MS, GAP_MAX_MS);

    const land = (): void => {
      flight = null;
      timer = setTimeout(depart, gap());
    };

    const depart = (): void => {
      const next = roll(id++);
      flight = next;
      timer = setTimeout(land, next.durationMs);
    };

    timer = setTimeout(depart, gap());
    return () => clearTimeout(timer);
  });
</script>

{#if flight}
  {#key flight.id}
    <div
      class="flock"
      style="
        top: {flight.top}%;
        --drift: {flight.drift}rem;
        --flight: {flight.durationMs}ms;
        opacity: {visible};
        animation-duration: {flight.durationMs}ms;
      "
      aria-hidden="true"
    >
      {#each FORMATION.slice(0, flight.count) as bird, i (i)}
        {@const period = flight.flapMs + i * 26}
        {@const phase = i * 47}
        <span
          class="bird"
          style="
            left: calc({bird.x}px * var(--ambient));
            top: calc({bird.y}px * var(--ambient));
            width: calc({SIZE}px * var(--ambient));
            height: calc({(SIZE * BIRD_VIEWBOX.height) / BIRD_VIEWBOX.width}px * var(--ambient));
            --period: {period}ms;
            --bob: calc({BOB}px * var(--ambient));
            --lead: calc({flight.leads[i].toFixed(2)}px * var(--ambient));
          "
        >
          <span class="bob" style="animation-delay: {phase}ms">
            <svg viewBox="0 0 {BIRD_VIEWBOX.width} {BIRD_VIEWBOX.height}">
              {#each BIRD_FRAMES as frame, f (f)}
                <g class="frame" style="animation-delay: {phase + (period * f) / 12}ms">
                  <path d={frame.far} fill="currentColor" opacity="0.93" />
                  <path d={BIRD_BODY} fill="currentColor" />
                  <path d={frame.near} fill="currentColor" />
                </g>
              {/each}
            </svg>
          </span>
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

  /* Each bird holds its own pace within the flock. The drift is centred on its
     place in the formation, so the group is in its designed shape halfway
     across and stretches gently either side of that. */
  .bird {
    position: absolute;
    animation-name: spread;
    animation-duration: var(--flight);
    animation-timing-function: linear;
    animation-fill-mode: both;
  }

  @keyframes spread {
    from {
      transform: translateX(calc(var(--lead) * -1));
    }
    to {
      transform: translateX(var(--lead));
    }
  }

  .bob {
    display: block;
    animation-name: bob;
    animation-duration: var(--period);
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Each frame owns one twelfth of the cycle. Swapping whole silhouettes is
     what lets the wing change shape as well as angle: it extends through the
     downstroke and folds on the recovery, which a rotation could never do. */
  .frame {
    opacity: 0;
    animation-name: show;
    animation-duration: var(--period);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  @keyframes show {
    0%,
    8.333% {
      opacity: 1;
    }
    8.334%,
    100% {
      opacity: 0;
    }
  }

  /* The body rises as the wings come down, because that is when the bird
     pushes against the air. */
  @keyframes bob {
    0% {
      transform: translateY(var(--bob));
    }
    35% {
      transform: translateY(calc(var(--bob) * -1));
    }
    100% {
      transform: translateY(var(--bob));
    }
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
