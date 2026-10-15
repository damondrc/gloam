/**
 * What Gloam says about itself, the first time it is opened.
 *
 * Four steps, and the number is the design. Everything else about this widget
 * announces itself the moment a pointer arrives: buttons fade in, tooltips say
 * what they do, the chevron is the ordinary "there is more below". What has to
 * be told is only what nothing on screen suggests — that the sky is the clock,
 * that there is no title bar to grab, that the padlock does something more
 * drastic than it looks, and that closing does not quit.
 *
 * A sixth step would be a manual. Two would leave out the idea the whole app
 * rests on.
 *
 * The text lives here rather than in the component for the ordinary reason:
 * it is content, it will be edited far more often than the thing that draws
 * it, and one day it may need a second language.
 */

/**
 * What the widget should draw attention to while a step is up.
 *
 * The tour unfolds below the widget rather than over it, which is what makes
 * this possible at all — a card covering the widget could only describe things
 * the reader had stopped being able to see.
 */
export type Spotlight = "none" | "controls" | "away";

import type { Messages } from "./i18n.svelte";

export interface TourStep {
  /** Which sentence is said, from `tour.steps` in the dictionary. */
  id: keyof Messages["tour"]["steps"];
  spotlight: Spotlight;
}

/**
 * The four steps are a ladder, and the rungs are how far out of your way
 * Gloam will get: what it is, where it goes, how to make it small, how to
 * make it disappear. Each one answers the objection the last might have
 * raised, which is what turns four facts into an introduction.
 *
 * Everything described here can be done while it is being described. The tour
 * folds itself away if the widget goes compact or gets locked, and comes back
 * on the same step — an instruction you are not allowed to follow is worse
 * than no instruction.
 *
 * The words are in the dictionary; this is only the order and what each step
 * lights up, which is the same in every language.
 */
export const TOUR: readonly TourStep[] = [
  { id: "sky", spotlight: "none" },
  { id: "handles", spotlight: "controls" },
  { id: "compact", spotlight: "none" },
  { id: "away", spotlight: "away" },
];
