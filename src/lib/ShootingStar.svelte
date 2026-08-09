<script lang="ts">
  /**
   * A shooting star, once in a very long while.
   *
   * The rarest thing in the widget, and deliberately so. Clouds are always
   * there because they are too slow to notice; a flock comes every few minutes
   * because it is fast enough to catch the eye and needs to be scarce to stay
   * welcome. This is a step further out: a couple of days of use between
   * sightings, which is the point. Something you see often is scenery.
   * Something you see almost never is a small event.
   *
   * It only falls at night, which in this widget means during a break — so
   * catching one is a reward for having stopped working.
   */
  interface Props {
    /** How dark the sky is, 0..1, from the star field. Nothing falls by day. */
    night: number;
    /** Stage size in design pixels, which sets how far there is to travel. */
    width: number;
    height: number;
  }

  let { night, width, height }: Props = $props();

  /** One roll of the dice every half minute of darkness. */
  const CHECK_MS = 30_000;
  const CHANCE = 0.01;

  /** Development only; Vite strips this branch from a release build. */
  const DEV_CHECK_MS = 7_000;

  /** Below this the sky is not dark enough for anything to show. */
  const NIGHT = 0.55;

  /** Length of the trail and speed of travel, in design pixels. */
  const TAIL = 210;
  const SPEED = 0.19;

  /** Fraction of the water band the reflection may descend through. */
  const WATER = 0.3;
  const WATER_USE = 0.55;

  interface Flight {
    id: number;
    /** Degrees, negative: always climbing, so it can never reach the water. */
    angle: number;
    /** Mirrored and shallower, for the reflection. */
    mirror: number;
    left: number;
    top: number;
    glintTop: number;
    travel: number;
    glintTravel: number;
    glintLength: number;
    durationMs: number;
  }

  let flight = $state<Flight | null>(null);

  const between = (min: number, max: number): number =>
    min + Math.random() * (max - min);

  const radians = (deg: number): number => (deg * Math.PI) / 180;

  function roll(id: number): Flight {
    // Always ascending. That is not a preference but the whole reason the
    // streak can never end up in the sea: it is travelling away from it.
    const angle = between(-13, -6);
    const left = between(-30, -10);

    // Far enough that the tail clears the frame too. Stopping when the head
    // leaves would delete two hundred pixels of lit trail in mid-air.
    const travel = (width + TAIL + 40 - left) / Math.cos(radians(angle));
    const horizontal = travel * Math.cos(radians(angle));

    // A reflection mirrors the vertical, so an ascending streak descends in
    // the water. Over a run this long, though, even a couple of degrees drops
    // further than the water band is tall — and a reflection that leaves the
    // bottom early is the same fault as one that leaves the side early. So the
    // mirror is halved, and then held to whatever there is room for.
    const wish = -angle * 0.5;
    const room =
      (Math.atan((height * WATER * WATER_USE) / horizontal) * 180) / Math.PI;
    const mirror = Math.min(wish, room);
    const mirrorCos = Math.cos(radians(mirror));

    return {
      id,
      angle,
      mirror,
      left,
      top: between(34, 48),
      glintTop: 78,
      travel,
      // Both are measured by the ground they cover rather than by the length of
      // their own path, since they ride differently tilted axes. Matching the
      // travel instead would let them drift apart across the crossing.
      glintTravel: horizontal / mirrorCos,
      glintLength: (TAIL * Math.cos(radians(angle))) / mirrorCos,
      durationMs: travel / SPEED,
    };
  }

  $effect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let clear: ReturnType<typeof setTimeout>;
    let id = 0;

    const period = import.meta.env.DEV ? DEV_CHECK_MS : CHECK_MS;
    const chance = import.meta.env.DEV ? 1 : CHANCE;

    const check = (): void => {
      timer = setTimeout(check, period);
      if (night < NIGHT || flight || Math.random() > chance) return;

      const next = roll(id++);
      flight = next;
      clear = setTimeout(() => (flight = null), next.durationMs + 200);
    };

    timer = setTimeout(check, period);

    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  });
</script>

{#if flight}
  {#key flight.id}
    <div
      class="streak"
      style="
        left: {flight.left}rem;
        top: {flight.top}%;
        --angle: {flight.angle.toFixed(2)}deg;
        --travel: {flight.travel.toFixed(1)}rem;
        --dur: {flight.durationMs.toFixed(0)}ms;
      "
      aria-hidden="true"
    >
      <i class="trail" style="width: {TAIL}rem"></i>
      <i class="head"></i>
    </div>

    <div
      class="streak glint"
      style="
        left: {flight.left}rem;
        top: {flight.glintTop}%;
        --angle: {flight.mirror.toFixed(2)}deg;
        --travel: {flight.glintTravel.toFixed(1)}rem;
        --dur: {flight.durationMs.toFixed(0)}ms;
      "
      aria-hidden="true"
    >
      <i class="smear" style="width: {flight.glintLength.toFixed(1)}rem"></i>
    </div>
  {/key}
{/if}

<style>
  .streak {
    position: absolute;
    width: 0;
    height: 0;
    transform: rotate(var(--angle));
    transform-origin: left center;
    pointer-events: none;
  }

  .streak i {
    position: absolute;
    display: block;
    animation: fly var(--dur) linear forwards;
  }

  /* One keyframe for every instance: the distance is a custom property, so
     nothing has to be generated per flight. */
  @keyframes fly {
    to {
      transform: translateX(var(--travel));
    }
  }

  /* No fade at either end. It enters and leaves at full strength, because it
     is not appearing and disappearing — it is passing through. */
  .trail {
    right: 0;
    top: -0.5rem;
    height: 1rem;
    background: linear-gradient(
      to right,
      transparent,
      rgb(var(--ink) / 0.18) 45%,
      rgb(var(--ink) / 0.6) 85%,
      rgb(var(--ink))
    );
  }

  /* Small enough to be almost nothing, which is the point: what you notice is
     the line, not the stone drawing it. */
  .head {
    left: -0.75rem;
    top: -0.75rem;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: rgb(var(--ink));
    box-shadow: 0 0 4rem rgb(var(--ink) / 0.9);
  }

  /* Not a mirror image — that would fall far below the frame — but the smear a
     bright object leaves along a moving surface. */
  .smear {
    right: 0;
    top: -2rem;
    height: 4rem;
    background: linear-gradient(
      to right,
      transparent,
      rgb(var(--ink) / 0.07) 45%,
      rgb(var(--ink) / 0.19) 85%,
      rgb(var(--ink) / 0.28)
    );
    filter: blur(2.5rem);
  }

  @media (prefers-reduced-motion: reduce) {
    .streak {
      display: none;
    }
  }
</style>
