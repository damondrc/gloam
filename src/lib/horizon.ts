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
 * Both of them are drawn in three planes at three distances, and distance is
 * drawn as a colour rather than as a transparency. One silhouette is a shape;
 * overlapping ones in different colours are depth, and depth is the whole
 * difference between a landscape and a jagged border. The city had one plane
 * for a long time and read as the border.
 *
 * The shapes are generated rather than drawn, so no artwork has to ship in the
 * repository and nothing has to be redrawn when a proportion changes.
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
   *
   * With three planes it does a second job, and the more important one: it is
   * painted *between* the far planes and the near one, so the near mass cuts
   * off the base of the towers behind it. Painted first instead, the distant
   * towers would sit on top of the street and float — two pictures stacked
   * again, which is the failure this whole file is arranged against.
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
 * Both thresholds are compared against numbers the sky is already
 * interpolating, so the city keeps time with the clock rather than running a
 * timer of its own. Nothing here animates; the comparison is a `min()` in the
 * stylesheet against two custom properties.
 *
 * An evening has two halves and they are not each other's reverse. Windows
 * come on through the sunset in one order and go out through the night in
 * another — the office that lit up first is not the one that goes dark first —
 * so a window carries a bedtime as well as a switch-on, and the second is not
 * derived from the first.
 */
export interface Lit {
  x: number;
  y: number;
  /**
   * The point in the evening this one comes on.
   *
   * Below zero for the windows that are never dark. A city is never all off.
   */
  wakes: number;
  /**
   * How much of the city has to still be up for this one to stay on.
   *
   * A high number is an early night. Below zero is a window that never goes
   * out at all: a stairwell, a floor still working, somebody who left it on.
   */
  sleeps: number;
  /**
   * How bright this one is, 0..1.
   *
   * A blind, a lamp instead of a ceiling light, a room two floors deep. The
   * variation is most of what stops a lit facade from reading as a grid.
   *
   * Scaled down by distance along with everything else: a window a mile off is
   * not as bright as the one across the street, and the alternative — every
   * plane burning at the same strength — undoes the depth the colours just
   * bought, because brightness reads as nearness more strongly than hue does.
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

/**
 * The city, nearest plane last.
 *
 * Painting order and depth order are the same list read forwards, which is the
 * only arrangement that keeps them from drifting apart: whatever is later in
 * this array is nearer, darker, and drawn over what came before it.
 */
export interface Skyline {
  planes: readonly (readonly Building[])[];
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

/** Roughly one window in eight is already on before the sun is down. */
const ALWAYS_LIT = 0.12;

/**
 * And roughly one in six is still on when the break ends.
 *
 * The number that decides whether a city at the end of a break reads as asleep
 * or as abandoned. Too few and the last frame of a break is a black shape with
 * three dots in it; too many and nothing happened.
 */
const NEVER_SLEEPS = 0.16;

function facade(
  rand: () => number,
  x: number,
  width: number,
  y: number,
  burnScale: number
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
        // A negative wake is already met at full daylight, which is how a
        // window stays lit rather than coming on. The rest spread across a
        // range that runs *past* one, so about a quarter of the city never
        // lights at all — which is what stops a full grid of identical
        // squares, and what leaves the sunset something still to fill in.
        wakes: rand() < ALWAYS_LIT ? -0.2 : 0.02 + rand() * 1.3,
        // The same trick upside down. A bedtime past the floor the break
        // reaches is a window that goes out during it; one below zero is a
        // window that never does.
        sleeps: rand() < NEVER_SLEEPS ? -0.2 : 0.05 + rand(),
        // Never all the way down to nothing: a window too dim to see is a
        // window that did not need generating.
        burn: (0.4 + rand() * 0.6) * burnScale,
      });
    }
  }
  return windows;
}

/**
 * How one plane of the city is proportioned.
 *
 * The three differ in more than colour, because aerial perspective on its own
 * is not depth — it is a wash. What actually separates a far plane from a near
 * one is that the far blocks are narrow, tall and crowded and the near ones
 * are wide, low and spaced: the same city, at a distance, has more of itself
 * per inch of frame.
 */
interface PlaneSpec {
  /** Block width, min and max. */
  width: readonly [number, number];
  /** Roof height, as a top edge. Larger y is a lower roof. */
  roof: readonly [number, number];
  /** How often a block touches the next rather than leaving a gap. */
  touch: number;
  gap: readonly [number, number];
  /** Only blocks taller than this may carry a mast, and only some of them. */
  mast: { taller: number; chance: number; length: number } | null;
  /** Distance takes the lights down with it. */
  burn: number;
}

/**
 * Nearest last, and each band of roofs overlapping the next by a pixel or two.
 *
 * The overlap is deliberate. Three bands that did not touch would stripe the
 * horizon into three readable rows, and a striped city is a bar chart. Letting
 * the tallest of one plane come up past the shortest of the plane in front is
 * what knits them into one mass with depth in it.
 */
const PLANES: readonly PlaneSpec[] = [
  {
    width: [6, 15],
    roof: [1, 9],
    touch: 0.5,
    gap: [1, 4],
    mast: { taller: 26, chance: 0.34, length: 5 },
    burn: 0.55,
  },
  {
    width: [9, 22],
    roof: [7, 15],
    touch: 0.58,
    gap: [1, 3.5],
    mast: { taller: 22, chance: 0.16, length: 4 },
    burn: 0.8,
  },
  {
    // Wider than they are tall, which is the one place the "no sheds" rule is
    // wrong: a block that fills the bottom of the frame is not a shed, it is
    // the near side of the street. Masts belong to the towers behind it.
    width: [13, 28],
    roof: [15, 22],
    touch: 0.62,
    gap: [1.5, 5],
    mast: null,
    burn: 1,
  },
];

function plane(rand: () => number, spec: PlaneSpec): Building[] {
  const between = ([min, max]: readonly [number, number]): number =>
    min + rand() * (max - min);

  const buildings: Building[] = [];

  let x = -OVERSHOOT;
  while (x < BOX.width + OVERSHOOT) {
    const width = between(spec.width);
    const y = between(spec.roof);
    const height = BOX.height - y;

    // Only the tall ones, and only some of them. A mast on every roof is a
    // texture; on one in five it is a detail.
    const mast =
      spec.mast && height > spec.mast.taller && rand() < spec.mast.chance
        ? {
            x: x + width / 2 - 0.4,
            width: 0.8,
            y: Math.max(0, y - (2 + rand() * spec.mast.length)),
          }
        : null;

    buildings.push({
      x,
      width,
      y,
      mast,
      windows: facade(rand, x, width, y, spec.burn),
    });

    // Touching more often than not. Gaps everywhere makes a row of towers;
    // a city is mostly one mass with light between the blocks.
    x += width + (rand() < spec.touch ? 0 : between(spec.gap));
  }

  return buildings;
}

/**
 * Throw away every window nothing will ever see.
 *
 * Three glazed planes generate something like four hundred rectangles and
 * roughly half of them are behind opaque mass — either behind a block in a
 * nearer plane, or below the street, which is painted over everything except
 * the near plane. They would cost a repaint each and show nobody anything.
 *
 * Done here rather than in the component because it is a fact about the city,
 * not about how it is drawn: whatever renders this should be able to walk the
 * windows and trust that every one of them is visible.
 */
function cull(planes: Building[][]): Building[][] {
  planes.forEach((buildings, i) => {
    const nearer = planes.slice(i + 1);
    // The street covers everything but the plane drawn after it.
    const floor = i === planes.length - 1 ? BOX.height : BOX.base;

    for (const building of buildings) {
      building.windows = building.windows.filter((w) => {
        if (w.y + WINDOW.height > floor) return false;

        for (const front of nearer) {
          for (const b of front) {
            const overlapsX = w.x + WINDOW.width > b.x && w.x < b.x + b.width;
            if (overlapsX && w.y + WINDOW.height > b.y) return false;
          }
        }

        return true;
      });
    }
  });

  return planes;
}

export function buildSkyline(seed: number): Skyline {
  const rand = rng(seed);
  return { planes: cull(PLANES.map((spec) => plane(rand, spec))) };
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
 * Distance is drawn the way it actually behaves: the far range is the tallest
 * in the frame, the palest and the most angular, and each nearer one is lower,
 * darker and rounder as the ground comes up to meet the viewer.
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
 * The cast, and the authorship.
 *
 * A seed is chosen the only way a seed can be chosen: by rendering it and
 * looking at it. Every number below was looked at, in daylight and at
 * midnight, and the ones that came out as a fence, a staircase or a smear are
 * not here. The generator can produce four billion cities; these are the ones
 * the app is willing to show.
 *
 * The file used to name one of each and say that a horizon which rearranged
 * itself between launches would be the opposite of ambient. Half of that still
 * holds and is the reason this is a short list rather than `Math.random()` fed
 * straight into the generator — an unvetted face is a face nobody approved.
 * The other half turned out to be about *when*, not *whether*. What breaks
 * ambience is something changing while you are looking at it; the widget is
 * opened once and left alone for hours, and finding a different city there the
 * next morning is a small pleasure rather than an interruption. Nothing moves
 * during a session, which is the promise that actually matters.
 *
 * Both lists are the test corpus as well as the cast: horizon.test.ts runs
 * every shape check over every seed here, so "picked at random" means "one of
 * these, all of which are known to hold together" rather than "whatever comes
 * out".
 */
export const SKYLINE_SEEDS: readonly number[] = [
  7, 21, 104, 1_051, 1_618, 5_813,
];

export const RIDGE_SEEDS: readonly number[] = [
  377_342, 1_204, 8_819, 26_501, 47_514, 71_060,
];

/** One roll, at import, which is once per launch of the app. */
function draw(cast: readonly number[]): number {
  return cast[Math.floor(Math.random() * cast.length)];
}

/**
 * Rolled once and held for the life of the window.
 *
 * Module scope is doing real work here. The horizon is switched in the panel
 * and switched back, the component mounts and unmounts with it, and none of
 * that may re-roll the city — the one thing worse than a face that never
 * changes is a face that changes while somebody is choosing it.
 */
export const SKYLINE_SEED = draw(SKYLINE_SEEDS);
export const RIDGE_SEED = draw(RIDGE_SEEDS);

export const SKYLINE: Skyline = buildSkyline(SKYLINE_SEED);
export const RIDGE: Ridge = buildRidge(RIDGE_SEED);
