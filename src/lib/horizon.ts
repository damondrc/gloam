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
 * Generated is not the same as geometric. Until 1.2 a building was a
 * rectangle and a range was a zigzag, and both looked like what they were:
 * the output of a loop. A building is now an outline with a roof of its own
 * and things standing on it, and a range is the envelope of summits that each
 * have two different slopes, with trees gathered in stands along the nearest.
 * The detail lives in the silhouette, because at this size the silhouette is
 * all there is — and it is kept quiet, because this is a backdrop under a
 * clock, and a backdrop that rewards a glance is one that takes it.
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

/** A point in the box, before it is written out for an SVG. */
type Point = readonly [number, number];

const points = (list: readonly Point[]): string =>
  list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

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
   * Its size, which used to be one constant for the whole city.
   *
   * A building picks a way of being glazed — squares, small panes, long
   * strips — and a street where every facade has the same windows at the same
   * pitch reads as one facade repeated, however the roofs differ.
   */
  width: number;
  height: number;
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

/** A tree in a gap, a shrub in a pot: the only round things in a city. */
export interface Round {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Something standing on a roof, in the same colour as the building under it.
 *
 * Three shapes are enough for everything up there: a rectangle is a chimney,
 * a mast, a post; a polygon is anything with a slope; a circle is a plant.
 */
export type Detail =
  | { shape: "rect"; x: number; y: number; width: number; height: number }
  | { shape: "polygon"; points: string }
  | ({ shape: "circle" } & Round);

export interface Building {
  x: number;
  width: number;
  /**
   * The highest point of the building itself, roof included.
   *
   * What stands on the roof may reach above it. This is the line a nearer
   * building hides things behind, so it is the mass and not the antenna.
   */
  y: number;
  /** Where the roof ends and the facade begins. Windows start below it. */
  eaves: number;
  /** The silhouette, as polygon points, closed against the bottom edge. */
  outline: string;
  details: Detail[];
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
  /** Trees in the gaps between the nearest buildings, standing on the street. */
  trees: readonly Round[];
}

/** A pine, standing on a range: where its trunk is, and how big it grew. */
export interface Pine {
  x: number;
  /** Its foot, sunk a little into the slope so neither corner floats. */
  base: number;
  height: number;
  /** Half its width at the foot. */
  spread: number;
}

/** One range: its line, and whatever grows along it. */
export interface Range {
  /** Polygon points, closed against the bottom corners of the box. */
  outline: string;
  trees: readonly Pine[];
}

/** The ranges, nearest last. */
export interface Ridge {
  /**
   * 0 is the farthest and palest, the last the nearest and darkest.
   *
   * Every one of them is opaque. Distance is a colour here, not a
   * transparency: a mountain the moon can be seen through is not a mountain,
   * and that is what a stack of translucent silhouettes gives you.
   */
  layers: readonly Range[];
}

/**
 * Where the air thickens, per horizon and per plane: the two heights in the
 * box between which a distant plane fades from its own colour toward the
 * colour of the sky behind it.
 *
 * Mist is still not a transparency. Each plane is filled with a gradient
 * between two opaque colours, so the foot of a far range is paler than its
 * summit and the sun still cannot be seen through either. What it buys is the
 * line where a nearer plane crosses a farther one: dark against pale instead
 * of dark against slightly less dark, which is most of what depth is at this
 * size. The nearest plane has none, because nothing is between it and you.
 */
export const HAZE = {
  skyline: { far: [3, BOX.base], mid: [9, BOX.base] },
  ridge: { far: [4, 20], mid: [12, 28] },
} as const;

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

type Band = readonly [number, number];
type Weighted<T> = readonly (readonly [T, number])[];

/** One of a list, with some more likely than others. */
function pick<T>(rand: () => number, options: Weighted<T>): T {
  let total = 0;
  for (const [, weight] of options) total += weight;
  let r = rand() * total;
  for (const [value, weight] of options) {
    r -= weight;
    if (r <= 0) return value;
  }
  return options[options.length - 1][0];
}

// --- the city -------------------------------------------------------------

/**
 * The ways a facade can be glazed: a window's size, the pitch it repeats at,
 * and how much of the wall is border.
 *
 * `grid` is the square every building used to have. `small` is a flat with
 * more rooms to the floor, and `strip` is the long window of a shop or a
 * workshop, which only the nearest plane is close enough to tell apart.
 */
export const GLAZING = {
  grid: { width: 1.8, height: 2.2, pitchX: 4.4, pitchY: 5.2, x: 2.6, top: 3.4, bottom: 3 },
  small: { width: 1.4, height: 1.6, pitchX: 3.5, pitchY: 4.1, x: 2.2, top: 2.6, bottom: 2.6 },
  strip: { width: 3.1, height: 1.2, pitchX: 4.9, pitchY: 3.7, x: 2.2, top: 3, bottom: 3 },
} as const;

type Glazing = keyof typeof GLAZING;

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
  eaves: number,
  burnScale: number,
  glazing: Glazing
): Lit[] {
  const g = GLAZING[glazing];
  const usableX = width - g.x * 2;
  // The whole facade, eaves to pavement. The horizon is a quarter of the
  // frame, so there is no dead mass below to keep clear of — the readout sits
  // above all of this rather than in front of it.
  const usableY = BOX.height - eaves - g.top - g.bottom;

  const cols = Math.floor((usableX + g.pitchX - g.width) / g.pitchX);
  const rows = Math.floor((usableY + g.pitchY - g.height) / g.pitchY);
  if (cols < 1 || rows < 1) return [];

  // Centred in what is left over, so a narrow building is not lit down one
  // side with a blank strip beside it.
  const spanX = cols * g.pitchX - (g.pitchX - g.width);
  const originX = x + (width - spanX) / 2;
  const originY = eaves + g.top;

  const windows: Lit[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      windows.push({
        x: originX + col * g.pitchX,
        y: originY + row * g.pitchY,
        width: g.width,
        height: g.height,
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
 * The roofs a building can have.
 *
 * This list is the answer to a city that looked like a bar chart. For a long
 * time every building was a rectangle and the only things that varied were
 * its width and its height, so the skyline was a row of boxes with the tops
 * at different levels — recognisably a city, and recognisably drawn by a
 * loop. What makes a street read as built by different people in different
 * decades is the roofline, and at thirty-three pixels the roofline is nearly
 * all there is.
 */
type Roof = "flat" | "setback" | "step" | "gable" | "slant" | "steeple" | "dome";

/** What can stand on a roof. */
type Item =
  | "box"
  | "hatch"
  | "ac"
  | "tank"
  | "antenna"
  | "aerial"
  | "chimney"
  | "plant"
  | "pergola";

/** A building while it is being put together. */
interface Draft {
  x: number;
  width: number;
  y: number;
  eaves: number;
  roof: Roof;
  outline: Point[];
  details: Detail[];
  /** Level stretches of roof things can stand on: from, to, and at what height. */
  flats: (readonly [number, number, number])[];
  /** How high the roof is at a given x, for whatever comes through a slope. */
  roofAt: (x: number) => number;
}

/** The lowest anything on a roof may reach: just inside the top of the box. */
const CEILING = 0.3;

function raise(rand: () => number, x: number, width: number, top: number, roof: Roof): Draft {
  const bottom = BOX.height;
  const right = x + width;
  const b: Draft = {
    x,
    width,
    y: top,
    eaves: top,
    roof,
    outline: [],
    details: [],
    flats: [],
    roofAt: () => top,
  };

  const flat = (): void => {
    b.roof = "flat";
    b.outline = [[x, bottom], [x, top], [right, top], [right, bottom]];
    b.flats = [[x, right, top]];
  };

  switch (roof) {
    // A block with a narrower one standing on it, or two. The top of a
    // building that was allowed to be tall as long as it stepped back.
    case "setback": {
      const inset = clamp(width * (0.1 + 0.1 * rand()), 1, 2.8);
      const rise = 1.5 + 2.3 * rand();
      if (width - 2 * inset < 2.4) {
        flat();
        break;
      }
      let two = width > 10 && rand() < 0.55;
      const inset2 = inset + clamp(width * (0.08 + 0.08 * rand()), 0.9, 2.2);
      const rise2 = 1.3 + 2 * rand();
      if (two && width - 2 * inset2 < 2) two = false;
      // Now and then only one shoulder steps back, which is the difference
      // between a tower and a building that had a neighbour on one side.
      const oneSide = !two && rand() < 0.25;
      const left = oneSide && rand() < 0.5 ? 0 : inset;
      const rightInset = oneSide && left !== 0 ? 0 : inset;
      if (two) {
        b.eaves = top + rise + rise2;
        const mid = b.eaves - rise;
        b.outline = [
          [x, bottom], [x, b.eaves], [x + inset, b.eaves], [x + inset, mid],
          [x + inset2, mid], [x + inset2, top], [right - inset2, top],
          [right - inset2, mid], [right - inset, mid], [right - inset, b.eaves],
          [right, b.eaves], [right, bottom],
        ];
        b.flats = [[x + inset2, right - inset2, top]];
      } else {
        b.eaves = top + rise;
        b.outline = [
          [x, bottom], [x, b.eaves], [x + left, b.eaves], [x + left, top],
          [right - rightInset, top], [right - rightInset, b.eaves],
          [right, b.eaves], [right, bottom],
        ];
        b.flats = [[x + left, right - rightInset, top]];
      }
      break;
    }
    // One pitch, higher at one end.
    case "slant": {
      const drop = Math.min(1.4 + 2.6 * rand(), width * 0.4);
      const leftHigh = rand() < 0.5;
      const yl = top + (leftHigh ? 0 : drop);
      const yr = top + (leftHigh ? drop : 0);
      b.outline = [[x, bottom], [x, yl], [right, yr], [right, bottom]];
      b.eaves = top + drop;
      b.roofAt = (at) => lerp(yl, yr, (at - x) / width);
      break;
    }
    // Two pitches meeting at a ridge, which is rarely dead centre. A steeple
    // is the same shape on a narrow tower, taller than it is wide.
    case "gable":
    case "steeple": {
      const rise =
        roof === "steeple"
          ? clamp(width * (0.8 + 0.4 * rand()), 3.5, 6)
          : clamp(width * (0.2 + 0.12 * rand()), 1.6, 4.4);
      const peak = x + width * (roof === "steeple" ? 0.5 : 0.38 + 0.24 * rand());
      b.eaves = top + rise;
      b.outline = [[x, bottom], [x, b.eaves], [peak, top], [right, b.eaves], [right, bottom]];
      b.roofAt = (at) =>
        at < peak
          ? lerp(b.eaves, top, (at - x) / (peak - x))
          : lerp(top, b.eaves, (at - peak) / (right - peak));
      if (roof === "steeple") {
        const tip = Math.max(CEILING, top - 1.6);
        b.details.push({ shape: "rect", x: peak - 0.25, y: tip, width: 0.5, height: top - tip + 0.4 });
      }
      break;
    }
    // A penthouse over part of the roof: the lift, the stairs, a top floor
    // somebody added later.
    case "step": {
      const upper = width * (0.34 + 0.3 * rand());
      const rise = 1.5 + 2.2 * rand();
      const onLeft = rand() < 0.5;
      b.eaves = top + rise;
      b.outline = onLeft
        ? [[x, bottom], [x, top], [x + upper, top], [x + upper, b.eaves], [right, b.eaves], [right, bottom]]
        : [[x, bottom], [x, b.eaves], [right - upper, b.eaves], [right - upper, top], [right, top], [right, bottom]];
      b.flats = onLeft
        ? [[x, x + upper, top], [x + upper, right, b.eaves]]
        : [[x, right - upper, b.eaves], [right - upper, right, top]];
      break;
    }
    // The one curve on the skyline, and rare enough to be a landmark.
    case "dome": {
      const r = clamp(width * 0.26, 1.6, 3);
      const cx = x + width / 2;
      b.eaves = top + r + 1.2;
      b.outline = [[x, bottom], [x, b.eaves], [right, b.eaves], [right, bottom]];
      const arc: Point[] = [];
      for (let k = 0; k <= 10; k += 1) {
        const a = (Math.PI * k) / 10;
        arc.push([cx - r * Math.cos(a), b.eaves - r * Math.sin(a)]);
      }
      b.details.push(
        { shape: "polygon", points: points(arc) },
        { shape: "rect", x: cx - 0.35, y: top, width: 0.7, height: 1.4 }
      );
      break;
    }
    default:
      flat();
  }
  return b;
}

/**
 * Everything that can stand on a level roof.
 *
 * Each one adds its shapes at `x`, standing on `y`, and answers with how wide
 * it turned out — or with nothing, when it would not fit under the top of the
 * box. Most of them are low on purpose. A roof is what the eye runs along,
 * and the things on it should be found by somebody looking rather than seen
 * by somebody glancing.
 */
const ITEMS: Record<
  Item,
  (rand: () => number, b: Draft, x: number, y: number) => number
> = {
  // A plant room, a tank housing: the plain box every flat roof has.
  box(rand, b, x, y) {
    const width = 2.4 + 1.8 * rand();
    const height = 1.3 + 0.8 * rand();
    if (y - height < CEILING) return 0;
    b.details.push({ shape: "rect", x, y: y - height, width, height });
    return width;
  },
  // The stair hatch, with its roof in a wedge.
  hatch(rand, b, x, y) {
    const width = 2.4 + 0.8 * rand();
    const high = 1.9 + 0.4 * rand();
    const low = 1.1;
    if (y - high < CEILING) return 0;
    const leftHigh = rand() < 0.5;
    b.details.push({
      shape: "polygon",
      points: points([
        [x, y],
        [x, y - (leftHigh ? high : low)],
        [x + width, y - (leftHigh ? low : high)],
        [x + width, y],
      ]),
    });
    return width;
  },
  // One air conditioner, or the pair of them.
  ac(rand, b, x, y) {
    if (y - 0.9 < CEILING) return 0;
    b.details.push({ shape: "rect", x, y: y - 0.9, width: 1.6, height: 0.9 });
    if (rand() < 0.5) {
      b.details.push({ shape: "rect", x: x + 2, y: y - 0.9, width: 1.6, height: 0.9 });
      return 3.6;
    }
    return 1.6;
  },
  // A water tank on legs, with its cap. The one thing up here with a shape
  // anybody would recognise, which is exactly why there are few of them: the
  // first version had one on most roofs, and a skyline of identical silhouettes
  // is a pattern, and a pattern is what the eye stops on.
  tank(_rand, b, x, y) {
    if (y - 4.1 < CEILING) return 0;
    b.details.push(
      { shape: "rect", x: x + 0.3, y: y - 1.2, width: 0.45, height: 1.2 },
      { shape: "rect", x: x + 2.05, y: y - 1.2, width: 0.45, height: 1.2 },
      { shape: "rect", x, y: y - 3.1, width: 2.8, height: 2 },
      { shape: "polygon", points: points([[x - 0.15, y - 3.1], [x + 1.4, y - 4.1], [x + 2.95, y - 3.1]]) }
    );
    return 2.8;
  },
  // A bare mast.
  antenna(rand, b, x, y) {
    const height = 2.4 + 2.6 * rand();
    const tip = Math.max(CEILING, y - height);
    b.details.push({ shape: "rect", x, y: tip, width: 0.5, height: y - tip });
    return 0.5;
  },
  // A television aerial: a mast with two crossbars.
  aerial(rand, b, x, y) {
    const height = 3 + 1.6 * rand();
    if (y - height < CEILING) return 0;
    b.details.push(
      { shape: "rect", x: x + 0.78, y: y - height, width: 0.45, height },
      { shape: "rect", x, y: y - height + 0.5, width: 2, height: 0.35 },
      { shape: "rect", x: x + 0.35, y: y - height + 1.4, width: 1.3, height: 0.35 }
    );
    return 2;
  },
  chimney(rand, b, x, y) {
    const height = 1.6 + rand();
    if (y - height < CEILING) return 0;
    b.details.push({ shape: "rect", x, y: y - height, width: 1.2, height });
    return 1.2;
  },
  // A shrub in a pot. The only round thing on a roof, and the reason a row of
  // them does not read as machinery.
  plant(rand, b, x, y) {
    const r = 0.85 + 0.45 * rand();
    if (y - 2 * r < CEILING) return 0;
    b.details.push({ shape: "circle", cx: x + r, cy: y - r * 0.8, r });
    return 2 * r;
  },
  // Two posts and a beam: somebody uses this roof.
  pergola(rand, b, x, y) {
    const width = 3 + 1.4 * rand();
    const height = 1.6 + 0.4 * rand();
    if (y - height - 0.4 < CEILING) return 0;
    b.details.push(
      { shape: "rect", x, y: y - height, width: 0.35, height },
      { shape: "rect", x: x + width - 0.35, y: y - height, width: 0.35, height },
      { shape: "rect", x: x - 0.3, y: y - height - 0.4, width: width + 0.6, height: 0.4 }
    );
    return width;
  },
};

/** How much stands on the roofs of one plane, and what. */
interface Rooftop {
  /** How likely each free stretch of roof is to carry the next thing. */
  chance: number;
  /** The most one building may carry. */
  max: number;
  items: Weighted<Item>;
  /** On a pitched roof: how likely a chimney is, an aerial, a dormer. */
  chimney?: number;
  aerial?: number;
  dormer?: number;
}

function furnish(rand: () => number, b: Draft, spec: Rooftop): void {
  if (b.flats.length === 0) {
    // A pitched roof carries different things, and they come through the
    // slope rather than standing on it.
    if (b.roof !== "gable" && b.roof !== "slant") return;

    if (spec.chimney && rand() < spec.chimney) {
      const cx = b.x + b.width * (rand() < 0.5 ? 0.2 + 0.1 * rand() : 0.7 + 0.1 * rand());
      const roof = b.roofAt(cx);
      if (roof - 1.5 > CEILING) {
        b.details.push({
          shape: "rect",
          x: cx - 0.55,
          y: roof - 1.5,
          width: 1.1,
          height: 1.5 + (b.eaves - roof) + 0.2,
        });
      }
    }
    if (spec.aerial && rand() < spec.aerial) {
      const cx = b.x + b.width * (0.3 + 0.4 * rand());
      ITEMS.aerial(rand, b, cx - 1, b.roofAt(cx) + 0.4);
    }
    // A dormer: a small house looking out of the roof of a larger one.
    if (b.roof === "gable" && spec.dormer && b.width > 11 && rand() < spec.dormer) {
      const cx = b.x + b.width * (rand() < 0.5 ? 0.24 + 0.06 * rand() : 0.7 + 0.06 * rand());
      const foot = Math.min(b.eaves, Math.max(b.roofAt(cx - 1), b.roofAt(cx + 1)) + 0.2);
      const roof = b.roofAt(cx);
      if (roof - 1.5 > CEILING) {
        b.details.push({
          shape: "polygon",
          points: points([
            [cx - 1, foot], [cx - 1, roof - 0.6], [cx, roof - 1.5],
            [cx + 1, roof - 0.6], [cx + 1, foot],
          ]),
        });
      }
    }
    return;
  }

  let count = 0;
  for (const [from, to, y] of b.flats) {
    let cursor = from + 0.6 + rand() * 1.4;
    while (cursor < to - 1.2 && count < spec.max) {
      if (rand() > spec.chance) {
        cursor += 2 + rand() * 3;
        continue;
      }
      const item = pick(rand, spec.items);
      const before = b.details.length;
      const used = ITEMS[item](rand, b, cursor, y);
      // Anything that would hang over the edge of its own roof is taken back
      // off again, so a detail always belongs to the building under it.
      if (used === 0 || cursor + used > to - 0.4) {
        b.details.length = before;
        cursor += 1.5;
        continue;
      }
      cursor += used + 0.8 + rand() * 2.6;
      count += 1;
    }
  }
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
  /** How wide a block may be. */
  width: Band;
  /** The band its highest point is drawn from; smaller is taller. */
  roof: Band;
  /** How often a block stands flush against the one before it. */
  touch: number;
  /** How wide the gap is when it does not. */
  gap: Band;
  /** Which roofs this plane has, and how often. */
  roofs: Weighted<Roof>;
  rooftop: Rooftop;
  glazing: Weighted<Glazing>;
  /** How likely a wide enough gap is to have a tree in it. */
  trees?: number;
  /** How brightly this plane's windows burn, as a fraction of the nearest's. */
  burn: number;
}

/**
 * Far, middle, near.
 *
 * The roof bands overlap by a pixel or two on purpose. Planes that stacked
 * perfectly — every far block taller than every middle one — would read as
 * three terraces, and a city is not terraced.
 *
 * It is a lived-in city rather than a business district, and that was chosen
 * by looking at both. Towers with stepped crowns and spires were drawn beside
 * it and are the more striking skyline, which is the argument against them:
 * this sits under a clock all day. A low, mixed, slightly crowded town has
 * about the same amount of everything all the way across, so the eye has
 * nowhere in particular to land, and that evenness is the quality wanted of a
 * backdrop.
 *
 * So the roofs change with distance as well as the proportions. Far off it is
 * mostly flat blocks with the odd steeple or dome among them; in the middle,
 * pitched roofs appear; and the nearest plane is houses, with gables and
 * chimneys and whatever people keep on a roof they can get out onto.
 */
const PLANES: readonly PlaneSpec[] = [
  {
    width: [7, 16],
    roof: [4, 11.5],
    touch: 0.5,
    gap: [1, 4],
    roofs: [["flat", 4], ["setback", 2], ["step", 2], ["gable", 1], ["slant", 1], ["steeple", 0.5], ["dome", 0.35]],
    rooftop: {
      chance: 0.3,
      max: 2,
      items: [["antenna", 2], ["box", 2], ["hatch", 1], ["tank", 0.35]],
      chimney: 0.3,
    },
    glazing: [["small", 3], ["grid", 3]],
    burn: 0.55,
  },
  {
    width: [9, 21],
    roof: [9.5, 16],
    touch: 0.58,
    gap: [1, 3.5],
    roofs: [["flat", 3], ["gable", 3], ["slant", 2], ["step", 2], ["setback", 1], ["steeple", 0.35]],
    rooftop: {
      chance: 0.5,
      max: 2,
      items: [["box", 2], ["aerial", 1.6], ["hatch", 1.5], ["chimney", 1.4], ["plant", 1], ["tank", 0.6]],
      chimney: 0.5,
      aerial: 0.18,
      dormer: 0.3,
    },
    glazing: [["small", 3], ["grid", 3]],
    burn: 0.8,
  },
  {
    width: [12, 26],
    roof: [16, 22],
    touch: 0.6,
    gap: [1.5, 5.5],
    roofs: [["gable", 4], ["flat", 3], ["slant", 2.5], ["step", 2]],
    rooftop: {
      chance: 0.6,
      max: 3,
      items: [
        ["box", 2], ["hatch", 1.6], ["aerial", 1.5], ["ac", 1.4], ["plant", 1.4],
        ["pergola", 1.2], ["chimney", 1.2], ["tank", 0.6],
      ],
      chimney: 0.55,
      aerial: 0.2,
      dormer: 0.4,
    },
    glazing: [["small", 3], ["grid", 2], ["strip", 0.6]],
    trees: 0.85,
    burn: 1,
  },
];

function plane(rand: () => number, spec: PlaneSpec, trees: Round[]): Building[] {
  const between = ([min, max]: Band): number => min + rand() * (max - min);

  const buildings: Building[] = [];
  let x = -OVERSHOOT;

  while (x < BOX.width + OVERSHOOT) {
    let width = between(spec.width);
    const top = between(spec.roof);
    let roof = pick(rand, spec.roofs);

    // A steeple is a tower, whatever width was drawn; a dome needs room to be
    // round in; and a single pitch across a wide building is a ramp.
    if (roof === "steeple") width = 4.4 + 2 * rand();
    if (roof === "dome") width = Math.max(width, 9);
    if (roof === "slant" && width > 13) roof = "step";

    const draft = raise(rand, x, width, top, roof);
    furnish(rand, draft, spec.rooftop);

    buildings.push({
      x,
      width,
      y: draft.y,
      eaves: draft.eaves,
      outline: points(draft.outline),
      details: draft.details,
      windows: facade(rand, x, width, draft.eaves, spec.burn, pick(rand, spec.glazing)),
    });

    // Some blocks stand shoulder to shoulder and some leave an alley, which
    // is what keeps the row from reading as a single extruded strip.
    const gap = rand() < spec.touch ? 0 : between(spec.gap);
    // And an alley wide enough gets a tree, standing on the street. Round,
    // which nothing else down here is.
    if (spec.trees && gap >= 2.6 && rand() < spec.trees) {
      const r = Math.min(gap / 2 - 0.2, 1.5 + 0.7 * rand());
      trees.push({ cx: x + width + gap / 2, cy: BOX.base - r * 0.75, r });
    }
    x += width + gap;
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
 * A nearer building hides everything below its highest point, across its
 * whole width. That is more than a gable really covers — there is sky either
 * side of the ridge — so a few windows that would have shown beside a roof
 * are dropped with the ones behind it. Erring that way round costs a handful
 * of lights; erring the other way would leave a lit square floating in a
 * neighbour's attic.
 *
 * Done here rather than in the component because it is a fact about the city,
 * not about how it is drawn: whatever renders this should be able to walk the
 * windows and trust that every one of them is visible.
 */
function cull(planes: Building[][]): Building[][] {
  planes.forEach((buildings, i) => {
    const nearer = planes.slice(i + 1);
    // Only the nearest plane is drawn after the street, so it is the only one
    // whose windows can be seen below it.
    const floor = i === planes.length - 1 ? BOX.height : BOX.base;

    for (const building of buildings) {
      building.windows = building.windows.filter((w) => {
        if (w.y + w.height > floor) return false;
        for (const front of nearer) {
          for (const b of front) {
            const overlapsX = w.x + w.width > b.x && w.x < b.x + b.width;
            if (overlapsX && w.y + w.height > b.y) return false;
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
  const trees: Round[] = [];
  const planes = cull(PLANES.map((spec) => plane(rand, spec, trees)));
  return { planes, trees };
}

// --- the range ------------------------------------------------------------

/**
 * A smooth random line, for everything about a mountain that is not its
 * summits: the roughness of a slope, and where along a range trees gather.
 *
 * Value noise, which is a table of random numbers and a smooth walk between
 * neighbours. Nine lines, for the same reason the generator above is.
 */
function noise(rand: () => number): (x: number) => number {
  const lattice = Array.from({ length: 256 }, () => rand());
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = lattice[((i % 256) + 256) % 256];
    const b = lattice[(((i + 1) % 256) + 256) % 256];
    return a + (b - a) * (f * f * (3 - 2 * f));
  };
}

/** How far apart a range is sampled. Finer than a pixel at any size it is shown. */
const SAMPLE = 1.25;

/** How trees grow along a range. */
interface Woods {
  /** How long a stretch of trees, or of none, tends to be. */
  patch: number;
  /**
   * How much of the range is wooded, upside down: the higher this is, the
   * less of the noise clears it and the more of the slope is left bare.
   */
  threshold: number;
  /** How often a single tree stands on its own between stands. */
  stray: number;
  height: Band;
  /** How far apart trees stand inside a stand. */
  gap: Band;
}

interface RangeSpec {
  /** The band summits are drawn from. */
  peak: Band;
  /** Where the valley floor would be if no slope reached it. */
  floor: number;
  /** How far apart summits stand. */
  step: Band;
  /**
   * How a slope falls away from its summit. Above one it curves inward, which
   * is a peak; a rounded range ignores it and uses a cosine instead, which is
   * a hill.
   */
  sharpness: Band;
  rounded?: boolean;
  /** How rugged the line is between summits. */
  rough: number;
  /** How often a lower shoulder stands between two summits. */
  shoulder?: number;
  /** The lowest the line may dip. */
  lowest: number;
  woods?: Woods;
}

/**
 * Far, middle, near: a sharp range, a rounded one, and a hill with trees on.
 *
 * The far range is the tallest and the most rugged, because distance is what
 * lets a mountain be seen whole. The middle one is rounded, with a little
 * wood on it. The nearest is low and smooth and carries most of the trees —
 * it is the ground the others are seen from.
 *
 * Trees are stands, not a row. The first version planted the near range from
 * end to end and it was the busiest thing in the widget: forty identical
 * points in a line is a comb, and the eye counts teeth. Here the noise decides
 * where trees gather, more than half of the slope is left bare, and a stand
 * is tallest in its middle and dwindles to its edges, so it has a shape of
 * its own rather than a start and a stop. The bare slope between two stands
 * is what lets either of them be noticed, and what lets both be ignored.
 */
const RANGES: readonly RangeSpec[] = [
  {
    peak: [1.2, 7.5],
    floor: 19,
    step: [26, 44],
    sharpness: [1.15, 1.5],
    rough: 0.85,
    shoulder: 0.5,
    lowest: 24,
  },
  {
    peak: [10.5, 15.5],
    floor: 26.5,
    step: [24, 40],
    sharpness: [1, 1],
    rounded: true,
    rough: 0.45,
    shoulder: 0.3,
    lowest: 29,
    woods: { patch: 44, threshold: 0.66, stray: 0, height: [1.5, 2.3], gap: [1.5, 2.4] },
  },
  {
    peak: [19, 23.5],
    floor: 30.5,
    step: [26, 46],
    sharpness: [1, 1],
    rounded: true,
    rough: 0.3,
    lowest: 31,
    woods: { patch: 52, threshold: 0.5, stray: 0.06, height: [2.8, 4.7], gap: [2, 3.3] },
  },
];

/** A range's line, as heights sampled left to right. */
interface Line {
  xs: number[];
  ys: number[];
}

/**
 * One range: the envelope of its summits.
 *
 * It used to be a zigzag — a point in a peak band, a point in a valley band,
 * and a straight line between each. That is the diagram of a mountain range,
 * and it looked like one: every slope the same kind of straight, every summit
 * a corner.
 *
 * Here each summit has a height and two slopes of its own, one either side,
 * and the range at any point is whichever summit stands highest there. Two
 * neighbours cross in a col rather than meeting at a point chosen for them,
 * no two slopes are the same length, and a little noise on top means that
 * nothing which looks like a straight line is one.
 */
function rangeLine(rand: () => number, spec: RangeSpec): Line {
  const between = ([min, max]: Band): number => min + rand() * (max - min);

  interface Summit {
    x: number;
    y: number;
    sharpness: number;
    minor?: boolean;
    left: number;
    right: number;
  }
  const summits: Summit[] = [];

  let x = -OVERSHOOT - spec.step[1];
  while (x < BOX.width + OVERSHOOT + spec.step[1]) {
    summits.push({ x, y: between(spec.peak), sharpness: between(spec.sharpness), left: 0, right: 0 });
    const stride = between(spec.step);
    if (spec.shoulder && rand() < spec.shoulder) {
      summits.push({
        x: x + stride * (0.4 + 0.2 * rand()),
        y: between(spec.peak) + (spec.floor - spec.peak[1]) * (0.3 + 0.25 * rand()),
        sharpness: between(spec.sharpness),
        minor: true,
        left: 0,
        right: 0,
      });
    }
    x += stride;
  }

  // Each slope reaches at least as far as the next summit, so two neighbours
  // always cross above the valley floor and the line never goes flat between
  // them.
  summits.sort((a, b) => a.x - b.x);
  summits.forEach((summit, i) => {
    const toLeft = i > 0 ? summit.x - summits[i - 1].x : spec.step[1];
    const toRight = i < summits.length - 1 ? summits[i + 1].x - summit.x : spec.step[1];
    const wider = summit.minor ? 1.1 : 1;
    summit.left = toLeft * (1 + 0.5 * rand()) * wider;
    summit.right = toRight * (1 + 0.5 * rand()) * wider;
  });

  const grain = noise(rand);
  const xs: number[] = [];
  const ys: number[] = [];

  for (let at = -OVERSHOOT; at <= BOX.width + OVERSHOOT + 0.01; at += SAMPLE) {
    let rise = 0;
    for (const summit of summits) {
      const d = (at - summit.x) / (at < summit.x ? summit.left : summit.right);
      if (d <= -1 || d >= 1) continue;
      const slope = spec.rounded
        ? 0.5 * (1 + Math.cos(Math.PI * d))
        : Math.pow(1 - Math.abs(d), summit.sharpness);
      rise = Math.max(rise, (spec.floor - summit.y) * slope);
    }
    // Three sizes of roughness at once: the lie of the land, the crags on
    // it, and a grain too fine to be seen as anything but not-a-ruler.
    const rough =
      spec.rough *
      ((grain(at / 13) - 0.5) + (grain(at / 4.7 + 60) - 0.5) * 0.5 + (grain(at / 2 + 140) - 0.5) * 0.22) *
      2;
    xs.push(at);
    ys.push(clamp(spec.floor - rise + rough, 0.5, spec.lowest));
  }

  return { xs, ys };
}

/** How high a range is at any x, between the samples either side. */
function heightAt(line: Line, x: number): number {
  const f = (x - line.xs[0]) / SAMPLE;
  const i = clamp(Math.floor(f), 0, line.xs.length - 2);
  return lerp(line.ys[i], line.ys[i + 1], clamp(f - i, 0, 1));
}

function forest(rand: () => number, line: Line, woods: Woods): Pine[] {
  const stands = noise(rand);
  const trees: Pine[] = [];
  let x = -OVERSHOOT + rand() * 2;

  while (x < BOX.width + OVERSHOOT) {
    const n = stands(x / woods.patch + 7);
    const wooded = n > woods.threshold;

    if (wooded || rand() < woods.stray) {
      // How far into the stand this is: nothing at its edge, one in its
      // middle. It is what makes a stand taper instead of stopping.
      const depth = clamp((n - woods.threshold) / 0.16, 0, 1);
      const height =
        (woods.height[0] + rand() * (woods.height[1] - woods.height[0])) *
        (wooded ? 0.55 + 0.45 * depth : 0.7);
      const spread = height * (0.25 + 0.09 * rand());
      // Standing on whichever side of it the slope is lower, and a little
      // into it, so that on a steep slope the downhill corner is not in the air.
      const base = Math.max(heightAt(line, x - spread), heightAt(line, x + spread)) + 0.35;
      if (base - height > 0.4) trees.push({ x, base, height, spread });
    }

    x += wooded
      ? woods.gap[0] + rand() * (woods.gap[1] - woods.gap[0])
      : woods.gap[1] + rand() * 5;
  }

  return trees;
}

/**
 * The trees of one range as a single path, a subpath to a tree.
 *
 * A pine is seven points: the tip, a step out and back at a little under half
 * way down, and the foot. The step is the whole difference between a conifer
 * and a triangle, and it is a pixel wide — it is not there to be seen, it is
 * there so that the outline is not a row of spikes when somebody does look.
 *
 * One path rather than an element per tree: they are all the colour of the
 * range they stand on, so nothing about them needs telling apart.
 */
export function pinePath(trees: readonly Pine[]): string {
  const n = (value: number): string => value.toFixed(2);
  return trees
    .map(({ x, base, height, spread }) => {
      const step = base - height * 0.42;
      return (
        `M${n(x)},${n(base - height)}` +
        `L${n(x + spread * 0.62)},${n(step)}L${n(x + spread * 0.36)},${n(step)}` +
        `L${n(x + spread)},${n(base)}L${n(x - spread)},${n(base)}` +
        `L${n(x - spread * 0.36)},${n(step)}L${n(x - spread * 0.62)},${n(step)}Z`
      );
    })
    .join("");
}

/**
 * Three ranges at three distances.
 *
 * The same three planes the city has, for the same reason: overlap in
 * different colours is depth, and one line of peaks is a border. The far
 * range is the tallest and the palest, because distance is what lets a
 * mountain be seen whole and what washes it out; each nearer one is lower,
 * darker, and in front.
 *
 * Each closes against the bottom edge of the frame rather than against a band
 * underneath. There is no band underneath: the ranges *are* the ground.
 */
export function buildRidge(seed: number): Ridge {
  const rand = rng(seed);
  // Every line first and the trees after, so that what grows on a range never
  // changes the shape of the one behind it.
  const lines = RANGES.map((spec) => rangeLine(rand, spec));

  return {
    layers: lines.map((line, i) => {
      const woods = RANGES[i].woods;
      const outline: Point[] = [[line.xs[0], BOX.height]];
      for (let k = 0; k < line.xs.length; k += 1) outline.push([line.xs[k], line.ys[k]]);
      outline.push([line.xs[line.xs.length - 1], BOX.height]);
      return {
        trees: woods ? forest(rand, line, woods) : [],
        outline: points(outline),
      };
    }),
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
 * A cast belongs to the generator it was chosen for. When the shapes were
 * redrawn in 1.2 the old numbers named cities nobody had seen, so both lists
 * were chosen again from two dozen candidates each. What went this time were
 * the ranges with a middle hill shaped like a lump, the cities where one
 * facade had more windows than its whole street, and — found by measuring
 * rather than by looking — two ranges whose nearest slope came out wooded
 * almost from end to end, which is the comb the stands exist to avoid.
 *
 * Both lists are the test corpus as well as the cast: horizon.test.ts runs
 * every shape check over every seed here, so "picked at random" means "one of
 * these, all of which are known to hold together" rather than "whatever comes
 * out".
 */
export const SKYLINE_SEEDS: readonly number[] = [7, 104, 404, 1_618, 2_024, 6_021];

export const RIDGE_SEEDS: readonly number[] = [1_204, 8_819, 71_060, 3_141, 4_242, 8_128];

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
