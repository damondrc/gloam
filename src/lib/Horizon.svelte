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
   * pass straight through the mountain in front of them. Both horizons are
   * drawn in three planes for the same reason: one silhouette is a shape, and
   * three at three distances is a place.
   *
   * Nothing here animates. The city lights out of two custom properties the
   * sky already publishes, compared against a pair of thresholds carried on
   * each window, which is why two hundred lit squares cost a repaint rather
   * than a frame loop. That is also why this is drawn in every ambience mode,
   * and in compact: Light exists to stop per-frame work and blurred surfaces,
   * and static geometry is neither.
   */
  import { BOX, RIDGE, SKYLINE, WINDOW } from "./horizon";
  import type { Horizon } from "./horizon";

  interface Props {
    kind: Horizon;
  }

  let { kind }: Props = $props();

  const planes = SKYLINE.planes;
  const nearest = planes.length - 1;
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
      {#each planes as blocks, plane (plane)}
        <!-- The street between the blocks, painted *between* the distant
             planes and the near one rather than under all of them. That is
             the whole trick: the near mass cuts off the base of the towers
             behind it, and a tower with its base cut off is a tower further
             away. Painted first instead, the distant blocks would sit on top
             of the street and float. -->
        {#if plane === nearest}
          <rect
            class="street"
            x="0"
            y={BOX.base}
            width={BOX.width}
            height={BOX.height - BOX.base}
          />
        {/if}

        <!-- Every silhouette in this plane, then every window in it. Drawn
             building by building, a mast would fall behind the neighbour it
             leans past. Each block runs the full way down to the bottom edge
             of the frame: they are the same mass as the ground, not something
             resting on top of it. -->
        {#each blocks as building, i (i)}
          <rect
            class="block plane-{plane}"
            x={building.x}
            y={building.y}
            width={building.width}
            height={BOX.height - building.y}
          />
          {#if building.mast}
            <rect
              class="block plane-{plane}"
              x={building.mast.x}
              y={building.mast.y}
              width={building.mast.width}
              height={building.y - building.mast.y}
            />
          {/if}
        {/each}

        {#each blocks as building, i (i)}
          {#each building.windows as light, j (j)}
            <rect
              class="lit"
              x={light.x}
              y={light.y}
              width={WINDOW.width}
              height={WINDOW.height}
              style="--wakes: {light.wakes}; --sleeps: {light.sleeps}; --burn: {light.burn}"
            />
          {/each}
        {/each}
      {/each}
    {:else}
      {#each RIDGE.layers as points, i (i)}
        <polygon {points} class="range plane-{i}" />
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

  /*
   * Three distances, three opaque colours the sky mixes as it goes, shared by
   * the city and the range so that switching between them is a change of
   * subject rather than a change of palette.
   */
  .plane-0 {
    fill: rgb(var(--ground-far));
  }

  .plane-1 {
    fill: rgb(var(--ground-mid));
  }

  .plane-2,
  .street {
    fill: rgb(var(--ground));
  }

  /*
   * A window is either on or off, at its own brightness.
   *
   * `opacity` does the switching and `fill-opacity` the brightness, and the
   * two multiply. Values outside 0..1 are clamped by opacity itself, which is
   * what lets a threshold below zero mean "always" and one above one mean
   * "never" without either needing a rule.
   *
   * `min()` of two comparisons rather than one, because an evening has two
   * halves. `--evening` rises while the sun goes down and then stays where it
   * is, so the first term is what switches a window on and never turns it back
   * off. `--awake` holds at 1 until the break and then falls, so the second
   * term is what puts it out. A window is lit while both agree — which means
   * the city fills in through the sunset, sits full through the top of the
   * night, and empties as the break runs down to the few that burn until
   * morning.
   *
   * The first version compared one threshold against the star field. Stars
   * only ever get brighter, so the city only ever got busier: it was at its
   * most awake at the very end of a break, which is exactly backwards.
   *
   * The multiplier is large enough that a window crosses from dark to lit in
   * about a second of a session rather than over a quarter of it: somebody
   * reached for a lamp. An earlier version eased each window in over a sixth
   * of the run, which looked less like a city coming on than like a dimmer
   * being turned up on all of it at once.
   *
   * The colour is the accent rather than a fixed amber, so the lights belong
   * to the same palette as everything else — warm while the sun is going
   * down, cool through a break.
   */
  .lit {
    fill: rgb(var(--accent));
    fill-opacity: var(--burn);
    opacity: min(
      (var(--evening) - var(--wakes)) * 1000,
      (var(--awake) - var(--sleeps)) * 1000
    );
    /* Long enough to read as a switch being thrown rather than as a cut, short
       enough that it is over before you have looked. It also covers the one
       moment the whole city changes at once — the start of a focus session,
       when the sun goes back up and the evening starts again — which without
       it is a hard blackout. Two bursts of compositing an hour, and nothing
       between them. */
    transition: opacity 0.45s linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .lit {
      transition: none;
    }
  }
</style>
