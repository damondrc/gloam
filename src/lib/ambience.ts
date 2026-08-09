/**
 * How much of the backdrop is alive.
 *
 * Three modes, because they answer three different questions rather than being
 * three degrees of one. *Calm* is about attention: it keeps the clouds, which
 * are too slow to notice, and drops the flock, which is not. *Light* is about
 * a laptop's battery and fan, and takes everything that costs something with
 * it — blurred surfaces and per-frame animation — leaving a flat sky.
 *
 * There was a fourth for a while, sitting between the two: one unblurred cloud
 * bank and nothing else. Blur is what makes a cloud a cloud, so all it did was
 * leave a shape on the sky. A mode has to be a coherent thing to want, not a
 * point on a slider.
 *
 * The sky, the horizon and the grain are never touched. They are the widget's
 * face rather than its ambience, and a mode that removed them would be a
 * different app rather than a quieter one.
 */

export type Ambience = "full" | "calm" | "light";

export const AMBIENCE_MODES: readonly Ambience[] = ["full", "calm", "light"];

export interface AmbienceSettings {
  /** How many cloud banks to draw, of the three defined. */
  cloudBanks: number;
  /** Blur is what makes a cloud a cloud, and also its whole cost. */
  cloudBlur: boolean;
  birds: boolean;
  /**
   * The rarest event of all. Off outside "full" for the same reason as the
   * flock: it crosses quickly, and calm exists so that nothing does.
   */
  meteor: boolean;
  /** Two large blurred gradients drifting on long loops. */
  haze: boolean;
  /** Whether the star field breathes or simply sits there. */
  twinkle: boolean;
}

export function ambienceSettings(mode: Ambience): AmbienceSettings {
  switch (mode) {
    case "full":
      return {
        cloudBanks: 3,
        cloudBlur: true,
        birds: true,
        meteor: true,
        haze: true,
        twinkle: true,
      };
    case "calm":
      return {
        cloudBanks: 3,
        cloudBlur: true,
        birds: false,
        meteor: false,
        haze: true,
        twinkle: true,
      };
    case "light":
      return {
        cloudBanks: 0,
        cloudBlur: false,
        birds: false,
        meteor: false,
        haze: false,
        twinkle: false,
      };
  }
}
