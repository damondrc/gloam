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

export interface TourStep {
  spotlight: Spotlight;
  /** Three lines at the panel's width. Longer and nobody reads it. */
  text: string;
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
 */
export const TOUR: readonly TourStep[] = [
  {
    spotlight: "none",
    text:
      "Gloam keeps time in the corner of your screen. The sky is the clock — " +
      "the sun sinks while you focus, and the moon comes up while you rest.",
  },
  {
    spotlight: "controls",
    text:
      "There is no title bar: drag it from anywhere on its face. The corner " +
      "resizes it, and the arrow below opens the settings.",
  },
  {
    spotlight: "none",
    text:
      "Too big? A double-click folds it into a single row — the clock, play " +
      "and the padlock. Try it: double-click again to bring it back.",
  },
  {
    spotlight: "away",
    text:
      "Still in the way? The padlock lets clicks pass right through, and " +
      "closing tucks Gloam into the tray with the run going. Ctrl+Alt+G " +
      "brings it back.",
  },
];
