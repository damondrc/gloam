/**
 * What the bottom of the widget is.
 *
 * Not something standing on the flat band: the band itself. Water is the band
 * Gloam has always had, and the other two *replace* it — a city or a ridge is
 * one continuous mass reaching the bottom edge of the frame, with a silhouette
 * for a top edge instead of a straight line. A skyline drawn above the band
 * and a band left underneath it reads as two pictures stacked, which is the
 * one thing it must not look like.
 *
 * And the whole of it is a quarter of the widget. The sky is the clock, so the
 * sky is what has to dominate; a horizon that reached halfway up would be a
 * landscape with a countdown in it rather than a countdown with a horizon.
 *
 * The shapes are generated rather than drawn, so no artwork has to ship in the
 * repository and nothing has to be redrawn when a proportion changes. They are
 * generated *once*, from a fixed seed, because a skyline that rearranged itself
 * between launches would be the opposite of ambient. Deterministic generation
 * is a way of authoring a constant, not a way of adding variety.
 *
 * Everything below is in the coordinate box the SVG is drawn in, with y
 * growing downward. The widget's proportions are fixed, so these are
 * effectively design pixels.
 */

import { NORMAL_SIZE } from "./layout";

export type Horizon = "water" | "skyline" | "ridge";

export const HORIZONS: readonly Horizon[] = ["water", "skyline", "ridge"];

export const BOX = {
  width: 320,
  /**
   * The whole horizon, roof to bottom edge: a quarter of the widget, no more.
   *
   * This is the number that matters most here, and the one the first attempt
   * got wrong. The sky is the clock, so the sky is what has to dominate the
   * frame; a horizon is the last quarter of it, and everything else — how tall
   * a tower may be, how much relief a range gets — is carved out of that
   * budget rather than added on top of a band that was already there.
   *
   * 33 of the widget's 132 design pixels. `y = 0` is as high as anything
   * reaches; `y = 33` is the bottom edge of the frame.
   */
  height: 33,
  /**
   * Where the ground between the shapes sits.
   *
   * Just enough that a gap between two blocks shows street rather than sky.
   * Everything stands directly on the bottom edge of the frame, so this is a
   * floor for the low points, not a band for the rest to rest on.
   */
  base: 23,
} as const;

/**
 * The horizon's share of the frame, whichever one is picked.
 *
 * Published to CSS as `--horizon` and read by all three: the water band's
 * height, the silhouettes', and how far a reflection may descend. One number,
 * so they cannot end up at three different heights and look like three
 * different ideas — which they did, and it was the thing most worth fixing.
 */
export const HORIZON_SHARE = BOX.height / NORMAL_SIZE.height;

/**
 * Shapes overshoot both edges rather than stopping at them.
 *
 * A skyline whose last building ends flush with the frame reads as a diagram
 * of a city. One cut off mid-building reads as a view of one that carries on.
 */
const OVERSHOOT = 12;

/**
 * A window: when it comes on, and how brightly it burns once it has.
 *
 * The threshold is compared against the star field's visibility, which is the
 * same 0..1 the sky is already interpolating — so the city lights up on the
 * clock rather than on a timer of its own. Nothing here animates; the
 * comparison is a `calc()` in the stylesheet against one custom property.
 *
 * Two numbers rather than one because a light and a fade are different events.
 * Somebody reaches for a switch: the window goes from dark to lit, at whatever
 * brightness that room happens to be. It does not ease in. Making every window
 * cross the same fade is what made the first attempt look like a dimmer being
 * turned up on the whole city at once.
 */
export interface Lit {
  x: number;
  y: number;
  /** Below zero for the windows that are never dark. A city is never all off. */
  threshold: number;
  /**
   * How bright this one is, 0..1.
   *
   * A blind, a lamp instead of a ceiling light, a room two floors deep. The
   * variation is most of what stops a lit facade from reading as a grid.
   */
  burn: number;
}

export interface Building {
  x: number;
  width: number;
  /** Top edge. The building runs from here down to the horizon line. */
  y: number;
  /** An aerial mast, on the few tall enough to carry one. */
  mast: { x: number; width: number; y: number } | null;
  windows: Lit[];
}

/** Ridge lines, as the polygon points an SVG needs, nearest layer last. */
export interface Ridge {
  /**
   * 0 is the farthest and palest, the last the nearest and darkest.
   *
   * Every one of them is opaque. Distance is a colour here, not a
   * transparency: a mountain the moon can be seen through is not a mountain,
   * and that is what a stack of translucent silhouettes gives you.
   */
  layers: readonly string[];
}

/**
 * mulberry32: small, fast, and good enough for deciding where a window goes.
 *
 * Written out rather than depended on. A seeded generator is nine lines, and
 * the alternative is a package in the lockfile for the length of one function.
 */
function rng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Window size and spacing. Loose enough that a lit one reads as a square.
 *
 * Only the position varies per window, so the size is exported for whatever
 * draws them rather than repeated on every one of the two hundred.
 */
export const WINDOW = {
  width: 1.8,
  height: 2.2,
  pitchX: 4.4,
  pitchY: 5.2,
} as const;

/** How much of a facade is border rather than windows. */
const INSET = { x: 2.6, top: 3.4, bottom: 3 } as const;

/** Roughly one window in eight burns all night and all day. */
const ALWAYS_LIT = 0.12;

function facade(
  rand: () => number,
  x: number,
  width: number,
  y: number
): Lit[] {
  const usableX = width - INSET.x * 2;
  // The whole facade, roof to pavement. The horizon is a quarter of the frame
  // now, so there is no dead mass below to keep clear of — the readout sits
  // above all of this rather than in front of it.
  const usableY = BOX.height - y - INSET.top - INSET.bottom;

  const cols = Math.floor((usableX + WINDOW.pitchX - WINDOW.width) / WINDOW.pitchX);
  const rows = Math.floor((usableY + WINDOW.pitchY - WINDOW.height) / WINDOW.pitchY);
  if (cols < 1 || rows < 1) return [];

  // Centred in what is left over, so a narrow building is not lit down one
  // side with a blank strip beside it.
  const spanX = cols * WINDOW.pitchX - (WINDOW.pitchX - WINDOW.width);
  const originX = x + (width - spanX) / 2;
  const originY = y + INSET.top;

  const windows: Lit[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      windows.push({
        x: originX + col * WINDOW.pitchX,
        y: originY + row * WINDOW.pitchY,
        // A negative threshold is already met at full daylight, which is how a
        // window stays lit rather than coming on. The rest spread across a
        // range that runs *past* one: the low ones come on while the sun is
        // still going down, the middle ones during a break, and the top of the
        // range is never reached at all. About a fifth of the city stays dark
        // all night, which is what stops a full grid of identical squares.
        threshold: rand() < ALWAYS_LIT ? -0.2 : 0.02 + rand() * 1.3,
        // Never all the way down to nothing: a window too dim to see is a
        // window that did not need generating.
        burn: 0.4 + rand() * 0.6,
      });
    }
  }
  return windows;
}

export function buildSkyline(seed: number): Building[] {
  const rand = rng(seed);
  const buildings: Building[] = [];

  let x = -OVERSHOOT;
  while (x < BOX.width + OVERSHOOT) {
    // Narrower than the box would allow, because the box is short: a block as
    // wide as it is tall is a shed. Roughly seventeen of them across a widget.
    const width = 11 + rand() * 15;
    const height = 12 + rand() * 21;
    const y = BOX.height - height;

    // Only the tall ones, and only some of them. A mast on every roof is a
    // texture; on one in five it is a detail.
    const mast =
      height > 24 && rand() < 0.3
        ? {
            x: x + width / 2 - 0.4,
            width: 0.8,
            y: Math.max(0, y - (3 + rand() * 5)),
          }
        : null;

    buildings.push({ x, width, y, mast, windows: facade(rand, x, width, y) });

    // Touching more often than not. Gaps everywhere makes a row of towers;
    // a city is mostly one mass with light between the blocks.
    x += width + (rand() < 0.55 ? 0 : 1 + rand() * 4);
  }

  return buildings;
}

type Band = readonly [number, number];

/**
 * One ridge line, as an SVG polygon closed against the bottom of the box.
 *
 * Points alternate between a peak band and a valley band rather than taking a
 * random height each time. Random heights make rolling ground; a mountain is
 * the alternation — up to a summit, down to a col, up again — and picking the
 * two bands separately is what gives it that shape at this size, where a whole
 * range gets eight pixels of relief and has no room to be subtle.
 */
function ridgeLine(
  rand: () => number,
  peak: Band,
  valley: Band,
  step: Band
): string {
  const between = ([min, max]: Band): number =>
    min + rand() * (max - min);

  const points: string[] = [`${-OVERSHOOT},${BOX.height}`];

  let x = -OVERSHOOT;
  let up = true;
  while (x < BOX.width + OVERSHOOT) {
    points.push(`${x.toFixed(1)},${between(up ? peak : valley).toFixed(1)}`);
    x += between(step);
    up = !up;
  }
  points.push(`${x.toFixed(1)},${between(up ? peak : valley).toFixed(1)}`);
  points.push(`${x.toFixed(1)},${BOX.height}`);

  return points.join(" ");
}

/**
 * Three lines rather than one, at three distances.
 *
 * A single silhouette is a shape; overlapping ones in different colours are
 * depth, and depth is the only thing that makes a ridge read as landscape
 * rather than as a jagged border. Distance is drawn the way it actually
 * behaves: the far range is the tallest in the frame, the palest and the most
 * angular, and each nearer one is lower, darker and rounder as the ground
 * comes up to meet the viewer.
 *
 * Each closes against the bottom edge of the frame rather than against a band
 * underneath. There is no band underneath: the ranges *are* the ground.
 */
export function buildRidge(seed: number): Ridge {
  const rand = rng(seed);
  return {
    layers: [
      ridgeLine(rand, [1, 8], [11, 17], [24, 44]),
      ridgeLine(rand, [10, 16], [19, 25], [17, 32]),
      ridgeLine(rand, [17, 23], [26, 31], [12, 24]),
    ],
  };
}

/**
 * The seeds are the authorship.
 *
 * Chosen by rendering a handful and looking at them, which is the only way to
 * choose them. Changing one changes the widget's face, so they live here as
 * named constants rather than being passed in from a component — this is the
 * line where "generated" stops and "drawn" begins.
 */
export const SKYLINE: readonly Building[] = buildSkyline(7);
export const RIDGE: Ridge = buildRidge(377_342);
