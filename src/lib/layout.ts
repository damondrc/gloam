/**
 * How big the widget is, in design pixels, before the scale is applied.
 *
 * These lived in `App.svelte` until something else needed them. Deciding where
 * the window should first appear means knowing how much room it will want —
 * including the room it will want a second later, when the tour unfolds
 * underneath it — and a second copy of `320` somewhere else is a number that
 * would eventually disagree with this one.
 *
 * Everything here is at scale 1. Multiply by the scale for design pixels, and
 * again by the monitor's scale factor for physical ones.
 */

/** The widget as it normally stands. */
export const NORMAL_SIZE = { width: 320, height: 132 } as const;

/** Folded to a single row: the clock, play and the padlock. */
export const COMPACT_SIZE = { width: 180, height: 58 } as const;

/**
 * How much taller the window gets with the settings unfolded.
 *
 * One height for every tab, sized to the tallest — a panel that resized as you
 * moved between tabs would make the window jump under the pointer that was
 * navigating it. Ambience is the tall one, and became so when the horizon
 * moved in beside the sound and the backdrop: a slider, three cyclers and the
 * two lines that say what the less obvious names are for.
 */
export const PANEL_HEIGHT = 190;

/**
 * And with the tour unfolded, which uses the same place.
 *
 * Shorter than the panel: three lines of text and a row of controls, with the
 * controls pinned to the bottom so they do not move between steps.
 */
export const TOUR_HEIGHT = 116;
