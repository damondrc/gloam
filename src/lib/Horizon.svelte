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
  import { BOX, HAZE, pinePath, RIDGE, SKYLINE } from "./horizon";
  import type { Horizon } from "./horizon";

  interface Props {
    kind: Horizon;
  }

  let { kind }: Props = $props();

  const planes = SKYLINE.planes;
  const nearest = planes.length - 1;

  /**
   * How a plane is filled: the two far ones with their mist, and the nearest
   * left to the stylesheet. A gradient is referenced by attribute rather than
   * from a rule, because `url(#…)` in a stylesheet is resolved against the
   * stylesheet in some engines and against the document in others, and an
   * attribute means the same thing in both.
   */
  const FILLS = ["url(#gloam-mist-far)", "url(#gloam-mist-mid)", undefined] as const;

  /** Where the mist starts and ends for whichever horizon is showing. */
  const haze = $derived(kind === "ridge" ? HAZE.ridge : HAZE.skyline);

  // Built once: the range is rolled at import and held, and so are its trees.
  const woods = RIDGE.layers.map((layer) => pinePath(layer.trees));
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
    <!-- One gradient per far plane, from its own colour at the top to the
         same colour with air in it at the foot. Both ends are opaque: this is
         mist as a colour, the same way distance is. -->
    <defs>
      <linearGradient
        id="gloam-mist-far"
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1={haze.far[0]}
        x2="0"
        y2={haze.far[1]}
      >
        <stop offset="0" class="far" />
        <stop offset="1" class="far-foot" />
      </linearGradient>
      <linearGradient
        id="gloam-mist-mid"
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1={haze.mid[0]}
        x2="0"
        y2={haze.mid[1]}
      >
        <stop offset="0" class="mid" />
        <stop offset="1" class="mid-foot" />
      </linearGradient>
    </defs>

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
          <!-- The trees in the alleys stand on it, in its colour. -->
          {#each SKYLINE.trees as tree, i (i)}
            <circle class="plane-{plane}" cx={tree.cx} cy={tree.cy} r={tree.r} />
          {/each}
        {/if}

        <!-- Every silhouette in this plane with whatever stands on its roof,
             then every window in it. Drawn in that order so a detail that
             leans over a neighbour is never painted across the neighbour's
             lit window. -->
        {#each blocks as building, i (i)}
          <polygon class="plane-{plane}" fill={FILLS[plane]} points={building.outline} />
          {#each building.details as detail, j (j)}
            {#if detail.shape === "rect"}
              <rect
                class="plane-{plane}"
                fill={FILLS[plane]}
                x={detail.x}
                y={detail.y}
                width={detail.width}
                height={detail.height}
              />
            {:else if detail.shape === "polygon"}
              <polygon class="plane-{plane}" fill={FILLS[plane]} points={detail.points} />
            {:else}
              <circle
                class="plane-{plane}"
                fill={FILLS[plane]}
                cx={detail.cx}
                cy={detail.cy}
                r={detail.r}
              />
            {/if}
          {/each}
        {/each}

        {#each blocks as building, i (i)}
          {#each building.windows as light, j (j)}
            <rect
              class="lit"
              x={light.x}
              y={light.y}
              width={light.width}
              height={light.height}
              style="--wakes: {light.wakes}; --sleeps: {light.sleeps}; --burn: {light.burn}"
            />
          {/each}
        {/each}
      {/each}
    {:else}
      <!-- A range's trees go down before the range itself. They are the same
           colour, so the order cannot be seen; it only means the slope covers
           each foot rather than each foot sitting on the slope. -->
      {#each RIDGE.layers as layer, i (i)}
        {#if woods[i]}
          <path class="plane-{i}" fill={FILLS[i]} d={woods[i]} />
        {/if}
        <polygon class="plane-{i}" fill={FILLS[i]} points={layer.outline} />
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
   *
   * Only the nearest has a rule. The two far planes are filled by a gradient
   * named in a `fill` attribute, and an attribute loses to any rule at all —
   * so giving them a colour here, even as a fallback, would be giving them
   * that colour instead of their mist.
   */
  .plane-2,
  .street {
    fill: rgb(var(--ground));
  }

  /* The stops: each far plane's own colour, and the same with air in it. */
  .far {
    stop-color: rgb(var(--ground-far));
  }

  .far-foot {
    stop-color: rgb(var(--mist-far));
  }

  .mid {
    stop-color: rgb(var(--ground-mid));
  }

  .mid-foot {
    stop-color: rgb(var(--mist-mid));
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
