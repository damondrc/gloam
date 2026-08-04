/**
 * Sound.
 *
 * The module is split along one line: an *instrument* decides how a single
 * note sounds, a *phrase* decides which notes and in what order. The phrases
 * are the app's vocabulary and do not change — a rising pair always means work
 * is starting. Swapping the instrument is how the timbre setting will work,
 * and adding one later is a single function rather than a redesign.
 *
 * Everything is synthesised rather than shipped as audio files: nothing to
 * license, nothing to decode, no binaries in the repository, and a timbre that
 * stays editable as code.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Browsers gate audio behind a user gesture; call this from a click handler. */
export function unlockAudio(): void {
  audio();
}

// --- settings ------------------------------------------------------------
// Exposed as setters rather than read from storage here, so this module stays
// a pure sound engine with no opinion about where preferences live.

export type Timbre = "bowl" | "bell" | "marimba" | "pulse";

/**
 * How button feedback sounds, or whether it does.
 *
 * "deep" exists because of a real difference between machines rather than a
 * taste for knobs: laptop speakers roll off below roughly 250 Hz, so a pause
 * cue built on a low fundamental is inaudible on one machine and the nicest
 * option on another. "soft" conveys the same settling with falling mid-range
 * tones, which every speaker can reproduce.
 */
export type InterfaceStyle = "off" | "soft" | "deep";

export const TIMBRES: readonly Timbre[] = ["bowl", "bell", "marimba", "pulse"];
export const INTERFACE_STYLES: readonly InterfaceStyle[] = ["off", "soft", "deep"];

let volume = 0.6;
let timbre: Timbre = "bowl";
let interfaceStyle: InterfaceStyle = "soft";

export function setVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next));
}

export function setTimbre(next: Timbre): void {
  timbre = next;
}

export function setInterfaceStyle(next: InterfaceStyle): void {
  interfaceStyle = next;
}

// --- one oscillator ------------------------------------------------------

function partial(
  freq: number,
  at: number,
  duration: number,
  gain: number,
  attack: number,
  detuneCents = 0
): void {
  if (volume <= 0 || gain <= 0) return;

  const c = audio();
  const start = c.currentTime + 0.02 + at;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.frequency.value = freq;
  if (detuneCents) osc.detune.value = detuneCents;

  const peak = gain * volume;
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(peak, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env);
  env.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// --- instruments ---------------------------------------------------------

interface Strike {
  freq: number;
  /** Seconds from the start of the phrase. */
  at: number;
  duration: number;
  gain: number;
}

type Instrument = (strike: Strike) => void;

/**
 * The default. A slow swell and a long tail, with a twin voice seven cents
 * away so the tail beats gently instead of sitting still — which is most of
 * what separates a struck bowl from a sine wave.
 */
const bowl: Instrument = ({ freq, at, duration, gain }) => {
  partial(freq, at, duration, gain, 0.09);
  partial(freq * 2.4, at, duration * 0.72, gain * 0.34, 0.09);
  partial(freq * 3.92, at, duration * 0.48, gain * 0.12, 0.09);
  partial(freq, at, duration, gain * 0.55, 0.11, 7);
};

/** Inharmonic partials and a long decay: metal, struck. */
const bell: Instrument = ({ freq, at, duration, gain }) => {
  partial(freq, at, duration, gain, 0.004);
  partial(freq * 2.756, at, duration * 0.86, gain * 0.5, 0.004);
  partial(freq * 5.404, at, duration * 0.72, gain * 0.24, 0.004);
  partial(freq * 8.933, at, duration * 0.58, gain * 0.1, 0.004);
};

/** Wood: a strong fourth partial, a fast attack and no tail. */
const marimba: Instrument = ({ freq, at, duration, gain }) => {
  const short = Math.min(duration, 0.75);
  partial(freq, at, short, gain, 0.002);
  partial(freq * 4, at, short * 0.86, gain * 0.32, 0.002);
  partial(freq * 9.2, at, short * 0.72, gain * 0.08, 0.002);
};

/** The plain sine of earlier versions, kept as the quietest option. */
const pulse: Instrument = ({ freq, at, duration, gain }) => {
  partial(freq, at, duration, gain, 0.015);
  partial(freq * 2, at, duration, gain * 0.16, 0.015);
};

const instruments: Record<Timbre, Instrument> = {
  bowl,
  bell,
  marimba,
  pulse,
};

// --- phrases -------------------------------------------------------------

/**
 * D4 and A4 — a perfect fifth, the most stable interval short of an octave,
 * and the one that wears best under repetition because it carries no mood of
 * its own. E5 tops the closing chord.
 */
const LOW = 293.66;
const HIGH = 440;
const TOP = 587.33;

/** Long enough for the first note to speak, short enough to read as one gesture. */
const PAIR_GAP = 0.42;

function pair(first: number, second: number): void {
  const play = instruments[timbre];
  play({ freq: first, at: 0, duration: 1.7, gain: 0.24 });
  play({ freq: second, at: PAIR_GAP, duration: 3.2, gain: 0.26 });
}

/**
 * The two transitions are the same two notes in opposite directions. Identical
 * material makes them audibly a pair; opposite direction makes them impossible
 * to confuse — and direction survives being half-heard, which matters because
 * these play when you are looking at something else.
 */
export function enterFocus(): void {
  pair(LOW, HIGH);
}

export function enterBreak(): void {
  pair(HIGH, LOW);
}

/** Longer and fuller than a transition: this marks an ending, not a change. */
export function runComplete(): void {
  const play = instruments[timbre];
  play({ freq: LOW, at: 0, duration: 2.6, gain: 0.22 });
  play({ freq: HIGH, at: 0.34, duration: 3.0, gain: 0.2 });
  play({ freq: TOP, at: 0.68, duration: 4.0, gain: 0.22 });
}

// --- interface feedback --------------------------------------------------

export type Press = "start" | "pause" | "reset" | "lock" | "unlock";

/**
 * Deliberately faint and brief. These fire on every button, so anything with
 * presence would compete with the transitions, which are the sounds that
 * actually carry information.
 *
 * They stay in the percussive family — short and dry — while the transitions
 * are sustained and musical. That separation is what keeps the padlock's
 * falling pair from being mistaken for a break beginning.
 */
export function press(kind: Press): void {
  if (interfaceStyle === "off") return;

  switch (kind) {
    // Rising: affirmative.
    case "start":
      partial(880, 0, 0.07, 0.08, 0.002);
      partial(1320, 0.045, 0.06, 0.04, 0.002);
      break;

    case "pause":
      if (interfaceStyle === "deep") {
        partial(150, 0, 0.14, 0.16, 0.002);
        partial(300, 0, 0.09, 0.04, 0.002);
      } else {
        // Two identical taps: repetition reads as "stop" without needing a
        // low fundamental to carry it.
        partial(500, 0, 0.05, 0.11, 0.002);
        partial(500, 0.075, 0.06, 0.085, 0.002);
      }
      break;

    // Neutral and mechanical.
    case "reset":
      partial(1760, 0, 0.05, 0.09, 0.001);
      partial(2640, 0, 0.035, 0.03, 0.001);
      break;

    // The padlock's pair, falling shut and springing open. It is the one
    // control that stays live when the widget stops accepting input, so a
    // press that made no sound would leave the user unsure it registered.
    case "lock":
      partial(620, 0, 0.05, 0.1, 0.002);
      partial(430, 0.07, 0.075, 0.1, 0.002);
      break;

    case "unlock":
      partial(430, 0, 0.05, 0.1, 0.002);
      partial(620, 0.07, 0.075, 0.1, 0.002);
      break;
  }
}

/** A single strike, so a timbre can be judged the moment it is chosen. */
export function preview(): void {
  instruments[timbre]({ freq: HIGH, at: 0, duration: 2.2, gain: 0.26 });
}
