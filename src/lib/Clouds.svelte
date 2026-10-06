<script lang="ts">
  /**
   * Drifting cloud bank.
   *
   * Governed by the rule the whole backdrop follows: continuous motion has to
   * be too slow to trigger peripheral vision, or it competes with the work the
   * widget exists to protect. A cloud takes between six and eight minutes to
   * cross at scale 1 — slow enough that you only register it moved by
   * comparing two glances.
   *
   * They render above the sun rather than behind it, so one passing across it
   * dims it for a moment. That occlusion is most of what separates a cloud from
   * a smudge.
   */
  interface Props {
    /** 0..1, driven by the sky state. */
    visible: number;
    /** How many banks to draw. Fewer is cheaper. */
    banks: number;
    /** Blur is what makes these read as cloud rather than blob, and also
        where nearly all of their cost is. */
    blur: boolean;
  }

  let { visible, banks, blur }: Props = $props();

  /**
   * Three banks at different heights, sizes and speeds, with negative delays
   * so they begin mid-crossing rather than filing in from the edge. The
   * durations share no common factor, so the group never visibly repeats.
   */
  const BANKS = [
    { top: 9, scale: 1, duration: 383, delay: -47, blur: 6, alpha: 1 },
    { top: 24, scale: 0.66, duration: 511, delay: -233, blur: 4.5, alpha: 0.8 },
    { top: 37, scale: 1.28, duration: 447, delay: -331, blur: 8, alpha: 0.75 },
  ];

  /** One cloud, as overlapping ellipses. Units are design pixels. */
  const PUFFS = [
    { x: 0, y: 9, w: 44, h: 14 },
    { x: 15, y: 1, w: 34, h: 19 },
    { x: 34, y: 6, w: 30, h: 14 },
    { x: 7, y: 13, w: 26, h: 10 },
  ];
</script>

<div class="clouds" style="opacity: {visible}" aria-hidden="true">
  {#each BANKS.slice(0, banks) as bank, i (i)}
    <div
      class="bank"
      style="
        top: {bank.top}%;
        --s: {bank.scale};
        --blur: {blur ? bank.blur : 0}rem;
        --alpha: {bank.alpha};
        animation-duration: {bank.duration}s;
        animation-delay: {bank.delay}s;
      "
    >
      {#each PUFFS as puff, j (j)}
        <i
          style="
            left: calc({puff.x}rem * var(--s) + var(--pad));
            top: calc({puff.y}rem * var(--s) + var(--pad));
            width: calc({puff.w}rem * var(--s));
            height: calc({puff.h}rem * var(--s));
          "
        ></i>
      {/each}
    </div>
  {/each}
</div>

<style>
  .clouds {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: opacity 0.6s linear;
  }

  .bank {
    position: absolute;
    left: 0;
    /* A real box around the puffs, with room for the blur to spread into.

       The bank used to have no size of its own — every puff inside it is
       absolutely positioned, so it collapsed to nothing at its top-left
       corner. Chromium works out how far a blur reaches from what the
       children draw and never noticed. WebKitGTK, on a layer composited for
       the drift animation, clipped the blurred result to the edges of the
       layer instead, and every bank crossed the sky with hard vertical seams
       down both sides of it: a cloud cut out with scissors after being
       softened. It only showed at dusk, because that is when the clouds are
       light enough against the sky for an edge to read.

       The box is the puffs' extent (64 by 23 at scale 1) plus three times the
       blur on every side, which is where a gaussian has faded to nothing. The
       negative margin puts the puffs back exactly where they were drawn, so
       nothing moves — the bank simply stops being smaller than its own
       picture. */
    --pad: calc(var(--blur) * 3);
    width: calc(64rem * var(--s) + var(--pad) * 2);
    height: calc(23rem * var(--s) + var(--pad) * 2);
    margin: calc(var(--pad) * -1) 0 0 calc(var(--pad) * -1);
    /* The blur is applied once to the whole bank rather than to each puff:
       four blurred layers per cloud would be four composited surfaces to
       animate instead of one. */
    filter: blur(var(--blur));
    animation-name: drift;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    will-change: transform;
  }

  .bank i {
    position: absolute;
    border-radius: 50%;
    background: rgb(var(--cloud) / var(--alpha));
    transition: background 0.6s linear;
  }

  /* Starts one frame width out to the right and leaves well past the left
     edge, so neither end of the crossing is ever visible as a pop. */
  @keyframes drift {
    from {
      transform: translateX(calc(var(--frame-w) * 1rem));
    }
    to {
      transform: translateX(calc(-90rem - var(--pad) * 2));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bank {
      animation: none;
      transform: translateX(calc(var(--frame-w) * 0.4rem));
    }
  }
</style>
