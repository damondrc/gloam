/**
 * The ambient backdrop.
 *
 * The widget shows a sky that moves through the end of a day, and the position
 * of the sky *is* the progress bar. During a focus session the sun descends
 * toward the horizon: the light draining out of the frame tells you your time
 * is running out without you having to read a number. During a break the moon
 * rises instead — the motion reverses, which reads as rest rather than urgency.
 *
 * Every visual property is interpolated between two keyframes, so the whole
 * look of the app is editable from this one file.
 */

export type Rgb = readonly [number, number, number];

export interface SkyState {
  /** Gradient stops, top of the frame to bottom. */
  top: Rgb;
  mid: Rgb;
  bottom: Rgb;
  /** The ground/sea band that the sun sinks behind. */
  ground: Rgb;
  /** Sun or moon. */
  body: Rgb;
  /** Vertical position of the celestial body, 0 = top edge, 1 = bottom edge. */
  bodyY: number;
  /** Radius of the body in pixels. */
  bodyR: number;
  /** How much atmospheric bloom surrounds the body, 0..1. */
  glow: number;
  /** Star field visibility, 0..1. */
  stars: number;
  /** Colour used for text, dots and the progress line. */
  accent: Rgb;
  /** Colour used for the large time readout. */
  ink: Rgb;
}

const FOCUS_START: SkyState = {
  top: [46, 58, 92],
  mid: [122, 92, 126],
  bottom: [232, 149, 94],
  ground: [38, 30, 54],
  body: [255, 217, 160],
  bodyY: 0.4,
  bodyR: 26,
  glow: 0.85,
  stars: 0,
  accent: [245, 199, 126],
  ink: [255, 244, 232],
};

const FOCUS_END: SkyState = {
  top: [20, 22, 43],
  mid: [59, 42, 74],
  bottom: [122, 59, 82],
  ground: [18, 15, 30],
  body: [255, 158, 122],
  bodyY: 0.86,
  bodyR: 30,
  glow: 0.45,
  stars: 0.35,
  accent: [232, 150, 130],
  ink: [246, 228, 224],
};

const BREAK_START: SkyState = {
  top: [12, 15, 34],
  mid: [26, 32, 63],
  bottom: [52, 58, 96],
  ground: [12, 12, 26],
  body: [199, 212, 245],
  bodyY: 0.68,
  bodyR: 17,
  glow: 0.3,
  stars: 0.55,
  accent: [168, 184, 232],
  ink: [231, 237, 255],
};

const BREAK_END: SkyState = {
  top: [9, 11, 27],
  mid: [20, 25, 52],
  bottom: [38, 44, 82],
  ground: [9, 9, 21],
  body: [226, 233, 255],
  bodyY: 0.22,
  bodyR: 15,
  glow: 0.5,
  stars: 1,
  accent: [186, 200, 240],
  ink: [238, 243, 255],
};

const DONE: SkyState = {
  top: [11, 14, 30],
  mid: [30, 30, 58],
  bottom: [74, 52, 88],
  ground: [12, 11, 24],
  body: [236, 226, 255],
  bodyY: 0.3,
  bodyR: 16,
  glow: 0.65,
  stars: 0.9,
  accent: [214, 186, 240],
  ink: [244, 238, 255],
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];

/** Ease so the sun lingers high early on and drops faster near the end. */
const easeIn = (t: number): number => t * t * (3 - 2 * t);

function mix(a: SkyState, b: SkyState, t: number): SkyState {
  const e = easeIn(Math.min(1, Math.max(0, t)));
  return {
    top: lerpRgb(a.top, b.top, e),
    mid: lerpRgb(a.mid, b.mid, e),
    bottom: lerpRgb(a.bottom, b.bottom, e),
    ground: lerpRgb(a.ground, b.ground, e),
    body: lerpRgb(a.body, b.body, e),
    bodyY: lerp(a.bodyY, b.bodyY, e),
    bodyR: lerp(a.bodyR, b.bodyR, e),
    glow: lerp(a.glow, b.glow, e),
    stars: lerp(a.stars, b.stars, e),
    accent: lerpRgb(a.accent, b.accent, e),
    ink: lerpRgb(a.ink, b.ink, e),
  };
}

export function skyFor(
  phase: "focus" | "break",
  progress: number,
  finished = false
): SkyState {
  if (finished) return DONE;
  return phase === "focus"
    ? mix(FOCUS_START, FOCUS_END, progress)
    : mix(BREAK_START, BREAK_END, progress);
}

const css = (c: Rgb): string => `${c[0]} ${c[1]} ${c[2]}`;

/** Flattens a SkyState into the CSS custom properties the markup consumes. */
export function skyVars(s: SkyState): string {
  return [
    `--sky-top: ${css(s.top)}`,
    `--sky-mid: ${css(s.mid)}`,
    `--sky-bottom: ${css(s.bottom)}`,
    `--ground: ${css(s.ground)}`,
    `--body: ${css(s.body)}`,
    `--body-y: ${(s.bodyY * 100).toFixed(2)}%`,
    `--body-r: ${s.bodyR.toFixed(1)}px`,
    `--glow: ${s.glow.toFixed(3)}`,
    `--stars: ${s.stars.toFixed(3)}`,
    `--accent: ${css(s.accent)}`,
    `--ink: ${css(s.ink)}`,
  ].join("; ");
}
