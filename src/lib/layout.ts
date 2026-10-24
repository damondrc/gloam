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
 * navigating it. Music is the tall one, measured in both languages: its last
 * switch plus the panel's bottom padding, with nothing to spare.
 *
 * Settings does not count towards it. Its index is shorter than Music, and a
 * page that runs longer scrolls inside the panel instead, so adding a setting
 * never makes every tab taller. That is why the number went down when the
 * panel was regrouped, from the 214 that four tabs needed.
 *
 * The cost of this being a single number is that the shortest tab carries the
 * tallest one's height, and Cycle has the emptiest bottom edge of the three.
 * That is the trade, and the alternative was measured and rejected rather than
 * overlooked.
 */
export const PANEL_HEIGHT = 189;

/**
 * And with the tour unfolded, which uses the same place.
 *
 * Shorter than the panel: three lines of text and a row of controls, with the
 * controls pinned to the bottom so they do not move between steps.
 */
export const TOUR_HEIGHT = 116;
