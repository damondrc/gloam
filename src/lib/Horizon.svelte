<script lang="ts">
  /**
   * The bottom of the widget, when it is not water.
   *
   * This *replaces* the flat band rather than standing on it. The mass reaches
   * the bottom edge of the frame and its top edge is the silhouette, so there
   * is no line across it and nothing underneath it — a skyline with a band
   * left showing below reads as two pictures stacked rather than as one place.
   *
   * And it is the last quarter of the widget, band and silhouette together.
   * The sky is the clock; anything down here that competes with it for the
   * frame is taking room from the thing being read.
   *
   * Every shape is opaque. Distance is drawn as a colour the sky mixes, not as
   * a transparency, because a translucent range would let the sun and the moon
   * pass straight through the mountain in front of them.
   *
   * Nothing here animates. The city lights out of one custom property the sky
   * already publishes, compared against a threshold carried on each window,
   * which is why two hundred lit squares cost a repaint rather than a frame
   * loop. That is also why this is drawn in every ambience mode, and in
   * compact: Light exists to stop per-frame work and blurred surfaces, and
   * static geometry is neither.
   */
  import { BOX, RIDGE, SKYLINE, WINDOW } from "./horizon";
  import type { Horizon } from "./horizon";

  interface Props {
    kind: Horizon;
  }

  let { kind }: Props = $props();
</script>

<!-- Water draws nothing at all: the band stays as it was, and the option
     exists to be chosen rather than to be drawn. -->
{#if kind !== "water"}
  <svg
    class="horizon"
    viewBox="0 0 {BOX.width} {BOX.height}"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    {#if kind === "skyline"}
      <!-- The street between the blocks. Drawn first, and low, because it is a
           floor for the gaps rather than a band for the rest to stand on. -->
      <rect x="0" y={BOX.base} width={BOX.width} height={BOX.height - BOX.base} />

      <!-- Every silhouette, then every window. Drawn building by building, a
           mast would fall behind the neighbour it leans past. Each block runs
           the full way down to the bottom edge of the frame: they are the same
           mass as the ground, not something resting on top of it. -->
      {#each SKYLINE as building, i (i)}
        <rect
          x={building.x}
          y={building.y}
          width={building.width}
          height={BOX.height - building.y}
        />
        {#if building.mast}
          <rect
            x={building.mast.x}
            y={building.mast.y}
            width={building.mast.width}
            height={building.y - building.mast.y}
          />
        {/if}
      {/each}

      {#each SKYLINE as building, i (i)}
        {#each building.windows as light, j (j)}
          <rect
            class="lit"
            x={light.x}
            y={light.y}
            width={WINDOW.width}
            height={WINDOW.height}
            style="--threshold: {light.threshold}; --burn: {light.burn}"
          />
        {/each}
      {/each}
    {:else}
      {#each RIDGE.layers as points, i (i)}
        <polygon {points} class="range range-{i}" />
      {/each}
    {/if}
  </svg>
{/if}

<style>
  /*
   * `--horizon` is the same share of the frame the water band takes, published
   * by App.svelte from one number, so the three cannot drift out of tune with
   * each other. A proportion rather than a length is also what carries this
   * into compact: the same quarter of a shorter frame, which turns the city
   * into a low profile instead of dropping it.
   *
   * `width: 100%` is not redundant beside `left: 0; right: 0`. An <svg> is a
   * replaced element, so `width: auto` resolves to its *intrinsic* width —
   * the viewBox ratio applied to the used height — and the two offsets are
   * then over-constrained, which means `right` is thrown away rather than the
   * width. At full size the arithmetic happens to land on the frame's width
   * and nothing looks wrong; in compact it came up forty pixels short and left
   * a bite out of the corner.
   */
  .horizon {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: var(--horizon);
    display: block;
    pointer-events: none;
  }

  rect {
    fill: rgb(var(--ground));
  }

  /* Three distances, three opaque colours the sky mixes as it goes. */
  .range-0 {
    fill: rgb(var(--ground-far));
  }

  .range-1 {
    fill: rgb(var(--ground-mid));
  }

  .range-2 {
    fill: rgb(var(--ground));
  }

  /*
   * A window is either on or off, at its own brightness.
   *
   * `opacity` does the switching and `fill-opacity` the brightness, and the
   * two multiply. The multiplier on the switch is large enough that a window
   * crosses from dark to lit in about a second of a session rather than over
   * a quarter of it: somebody reached for a lamp. Values outside 0..1 are
   * clamped by opacity itself, which is what lets a threshold below zero mean
   * "always on" and one above one mean "never" without either needing a rule.
   *
   * An earlier version eased each window in over a sixth of the run, which
   * looked less like a city coming on than like a dimmer being turned up on
   * all of it at once.
   *
   * The colour is the accent rather than a fixed amber, so the lights belong
   * to the same palette as everything else — warm while the sun is going
   * down, cool through a break.
   */
  .lit {
    fill: rgb(var(--accent));
    fill-opacity: var(--burn);
    opacity: calc((var(--stars) - var(--threshold)) * 1000);
  }
</style>
