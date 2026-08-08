/**
 * Sound.
 *
 * The module is split along one line: an *instrument* decides how a single
 * note sounds, a *phrase* decides which notes and in what order. Phrases are
 * the app's vocabulary and do not change — a rising pair always means work is
 * starting. Instruments are what the settings swap, so adding one is a
 * function rather than a redesign.
 *
 * Everything is synthesised rather than shipped as audio files: nothing to
 * license, nothing to decode, no binaries in the repository, and a timbre that
 * stays editable as code.
 *
 * One rule governs the whole palette: it has to sound like the same place. The
 * alarms are a struck bowl, so the buttons are struck or plucked or dropped
 * things too — soft attacks, some warmth, no digital edges.
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

export type Timbre = "bowl" | "bell" | "marimba" | "pulse";
export type AlarmPattern = "fifth" | "triad" | "echo";
export type ButtonSet = "bowl" | "felt" | "string" | "drop";

export const TIMBRES: readonly Timbre[] = ["bowl", "bell", "marimba", "pulse"];
export const ALARM_PATTERNS: readonly AlarmPattern[] = ["fifth", "triad", "echo"];
export const BUTTON_SETS: readonly ButtonSet[] = ["bowl", "felt", "string", "drop"];

let volume = 0.6;
let timbre: Timbre = "bowl";
let pattern: AlarmPattern = "fifth";
let buttons: ButtonSet = "bowl";

export function setVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next));
}

export function setTimbre(next: Timbre): void {
  timbre = next;
}

export function setAlarmPattern(next: AlarmPattern): void {
  pattern = next;
}

export function setButtonSet(next: ButtonSet): void {
  buttons = next;
}

// --- one gesture at a time -----------------------------------------------

interface Sounding {
  source: AudioScheduledSourceNode;
  env: GainNode;
}

let sounding: Sounding[] = [];

function register(source: AudioScheduledSourceNode, env: GainNode): void {
  const entry = { source, env };
  sounding.push(entry);
  source.onended = () => {
    const index = sounding.indexOf(entry);
    if (index >= 0) sounding.splice(index, 1);
  };
}

/**
 * Fades out whatever is still ringing.
 *
 * Called once at the start of every gesture, never per note — the notes within
 * a phrase are scheduled together and would otherwise cancel each other. What
 * it buys is that auditioning a setting plays the thing you picked rather than
 * the thing you picked on top of the last two, which is the whole reason to be
 * in that menu.
 *
 * A short ramp rather than an immediate stop, because cutting a waveform
 * mid-cycle is a click.
 */
function silence(): void {
  if (sounding.length === 0) return;

  const now = audio().currentTime;
  for (const { source, env } of sounding) {
    try {
      env.gain.cancelScheduledValues(now);
      env.gain.setValueAtTime(env.gain.value, now);
      env.gain.linearRampToValueAtTime(0.0001, now + 0.025);
      source.stop(now + 0.035);
    } catch {
      // Already finished, or never started. Either way there is nothing to do.
    }
  }
  sounding = [];
}

// --- primitives ----------------------------------------------------------

interface Tone {
  freq: number;
  /** Seconds from the start of the phrase. */
  at: number;
  duration: number;
  gain: number;
  attack?: number;
  /** Bends to this frequency, which is what makes a drop sound like water. */
  bendTo?: number;
  /** Rolls off everything above, which is what makes a mallet sound felted. */
  lowpass?: number;
  detuneCents?: number;
  type?: OscillatorType;
}

function tone(t: Tone): void {
  if (volume <= 0 || t.gain <= 0) return;

  const c = audio();
  const start = c.currentTime + 0.02 + t.at;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = t.type ?? "sine";
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.bendTo) {
    osc.frequency.exponentialRampToValueAtTime(t.bendTo, start + t.duration * 0.7);
  }
  if (t.detuneCents) osc.detune.value = t.detuneCents;

  const peak = t.gain * volume;
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(peak, start + (t.attack ?? 0.004));
  env.gain.exponentialRampToValueAtTime(0.0001, start + t.duration);

  osc.connect(env);

  if (t.lowpass) {
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = t.lowpass;
    filter.Q.value = 0.7;
    env.connect(filter);
    filter.connect(c.destination);
  } else {
    env.connect(c.destination);
  }

  osc.start(start);
  osc.stop(start + t.duration + 0.05);
  register(osc, env);
}

/** A filtered burst, used for the transient of a pluck or the thud of felt. */
function noise(
  freq: number,
  q: number,
  at: number,
  duration: number,
  gain: number,
  type: BiquadFilterType = "bandpass"
): void {
  if (volume <= 0 || gain <= 0) return;

  const c = audio();
  const start = c.currentTime + 0.02 + at;
  const length = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  const source = c.createBufferSource();
  source.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;

  const env = c.createGain();
  env.gain.setValueAtTime(gain * volume, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(env);
  env.connect(c.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
  register(source, env);
}

// --- alarm instruments ---------------------------------------------------

interface Strike {
  freq: number;
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
  tone({ freq, at, duration, gain, attack: 0.09 });
  tone({ freq: freq * 2.4, at, duration: duration * 0.72, gain: gain * 0.34, attack: 0.09 });
  tone({ freq: freq * 3.92, at, duration: duration * 0.48, gain: gain * 0.12, attack: 0.09 });
  tone({ freq, at, duration, gain: gain * 0.55, attack: 0.11, detuneCents: 7 });
};

/** Inharmonic partials and a long decay: metal, struck. */
const bell: Instrument = ({ freq, at, duration, gain }) => {
  tone({ freq, at, duration, gain, attack: 0.004 });
  tone({ freq: freq * 2.756, at, duration: duration * 0.86, gain: gain * 0.5, attack: 0.004 });
  tone({ freq: freq * 5.404, at, duration: duration * 0.72, gain: gain * 0.24, attack: 0.004 });
  tone({ freq: freq * 8.933, at, duration: duration * 0.58, gain: gain * 0.1, attack: 0.004 });
};

/** Wood: a strong fourth partial, a fast attack and no tail. */
const marimba: Instrument = ({ freq, at, duration, gain }) => {
  const short = Math.min(duration, 0.75);
  tone({ freq, at, duration: short, gain, attack: 0.002 });
  tone({ freq: freq * 4, at, duration: short * 0.86, gain: gain * 0.32, attack: 0.002 });
  tone({ freq: freq * 9.2, at, duration: short * 0.72, gain: gain * 0.08, attack: 0.002 });
};

/** The plain sine of earlier versions, kept as the quietest option. */
const pulse: Instrument = ({ freq, at, duration, gain }) => {
  tone({ freq, at, duration, gain, attack: 0.015 });
  tone({ freq: freq * 2, at, duration, gain: gain * 0.16, attack: 0.015 });
};

const instruments: Record<Timbre, Instrument> = { bowl, bell, marimba, pulse };

// --- alarm phrases -------------------------------------------------------

/**
 * D4, A4 and D5. The fifth is the most stable interval short of an octave and
 * the one that wears best under repetition, because it carries no mood of its
 * own.
 */
const LOW = 293.66;
const HIGH = 440;
const TOP = 587.33;

/** Long enough for a note to speak, short enough to read as one gesture. */
const GAP = 0.42;

function play(strikes: Strike[]): void {
  const instrument = instruments[timbre];
  for (const strike of strikes) instrument(strike);
}

/**
 * The two transitions are always the same material in opposite directions.
 * Identical notes make them audibly a pair; opposite direction makes them
 * impossible to confuse — and direction survives being half-heard, which is
 * the condition these play under.
 */
function transition(rising: boolean): void {
  silence();

  switch (pattern) {
    case "fifth":
      play([
        { freq: rising ? LOW : HIGH, at: 0, duration: 1.7, gain: 0.24 },
        { freq: rising ? HIGH : LOW, at: GAP, duration: 3.2, gain: 0.26 },
      ]);
      break;

    // Three notes: more ceremony, for someone who wants the change announced.
    case "triad":
      play([
        { freq: rising ? LOW : TOP, at: 0, duration: 1.5, gain: 0.22 },
        { freq: HIGH, at: 0.3, duration: 1.8, gain: 0.2 },
        { freq: rising ? TOP : LOW, at: 0.6, duration: 2.8, gain: 0.23 },
      ]);
      break;

    // One note answering itself, fading. The quietest of the three.
    case "echo":
      play([
        { freq: HIGH, at: 0, duration: 2.6, gain: 0.26 },
        { freq: HIGH, at: 0.62, duration: 2.2, gain: 0.11 },
        { freq: rising ? TOP : LOW, at: 1.24, duration: 2.8, gain: 0.065 },
      ]);
      break;
  }
}

export function enterFocus(): void {
  transition(true);
}

export function enterBreak(): void {
  transition(false);
}

/** Longer and fuller than a transition: this marks an ending, not a change. */
export function runComplete(): void {
  silence();
  play([
    { freq: LOW, at: 0, duration: 2.6, gain: 0.22 },
    { freq: HIGH, at: 0.34, duration: 3.0, gain: 0.2 },
    { freq: TOP, at: 0.68, duration: 4.0, gain: 0.22 },
  ]);
}

/** Plays what a choice actually sounds like, at the moment it is made. */
export function preview(): void {
  enterFocus();
}

// --- buttons -------------------------------------------------------------

export type Press = "start" | "pause" | "reset" | "lock" | "unlock";

interface Note {
  freq: number;
  at: number;
  gain: number;
  duration: number;
  /** Only the water set bends; the others ignore it. */
  bendTo?: number;
}

type Voice = (note: Note) => void;

/**
 * A smaller sibling of the alarm bowl: same partials, a fraction of the
 * length. Pitched a fourth below where it started out and with the brightest
 * partial pulled back — at twenty presses an hour, glitter turns into
 * grating.
 */
const bowlButton: Voice = ({ freq, at, gain, duration }) => {
  tone({ freq, at, duration, gain, attack: 0.03, lowpass: 2600 });
  tone({ freq: freq * 2.4, at, duration: duration * 0.7, gain: gain * 0.3, attack: 0.03, lowpass: 2600 });
  tone({ freq: freq * 3.92, at, duration: duration * 0.4, gain: gain * 0.06, attack: 0.03, lowpass: 2600 });
  tone({ freq, at, duration, gain: gain * 0.5, attack: 0.04, detuneCents: 7, lowpass: 2600 });
};

/** A mallet wrapped in felt: no click, warm, gone quickly. */
const feltButton: Voice = ({ freq, at, gain, duration }) => {
  tone({ freq, at, duration, gain, attack: 0.022, lowpass: 1400 });
  tone({ freq: freq * 2, at, duration: duration * 0.6, gain: gain * 0.2, attack: 0.026, lowpass: 1400 });
  noise(420, 1, at, 0.05, gain * 0.14, "lowpass");
};

/** Nylon: a quick pluck, harmonics that fade at different rates. */
const stringButton: Voice = ({ freq, at, gain, duration }) => {
  tone({ freq, at, duration, gain, attack: 0.004, lowpass: 2600 });
  tone({ freq: freq * 2, at, duration: duration * 0.55, gain: gain * 0.3, attack: 0.004, lowpass: 2600 });
  tone({ freq: freq * 3, at, duration: duration * 0.3, gain: gain * 0.12, attack: 0.004, lowpass: 2600 });
  noise(2200, 1.5, at, 0.018, gain * 0.18);
};

/** Water: the pitch bends as the drop lands, so the gesture carries itself. */
const dropButton: Voice = ({ freq, at, gain, duration, bendTo }) => {
  tone({ freq, bendTo, at, duration, gain, attack: 0.003, lowpass: 3000 });
  tone({
    freq: freq * 2,
    bendTo: bendTo ? bendTo * 2 : undefined,
    at,
    duration: duration * 0.5,
    gain: gain * 0.14,
    attack: 0.003,
  });
};

interface ButtonKit {
  voice: Voice;
  notes: Record<Press, Note[]>;
}

/**
 * Every set keeps the same grammar, so the meaning survives changing the
 * material: start rises, pause falls, reset is neutral, locking falls shut and
 * unlocking springs open.
 */
const kits: Record<ButtonSet, ButtonKit> = {
  bowl: {
    voice: bowlButton,
    notes: {
      start: [
        { freq: 659, at: 0, gain: 0.16, duration: 0.36 },
        { freq: 880, at: 0.075, gain: 0.15, duration: 0.44 },
      ],
      pause: [
        { freq: 880, at: 0, gain: 0.15, duration: 0.36 },
        { freq: 659, at: 0.075, gain: 0.16, duration: 0.5 },
      ],
      reset: [{ freq: 784, at: 0, gain: 0.14, duration: 0.26 }],
      lock: [
        { freq: 740, at: 0, gain: 0.15, duration: 0.34 },
        { freq: 554, at: 0.07, gain: 0.16, duration: 0.46 },
      ],
      unlock: [
        { freq: 554, at: 0, gain: 0.16, duration: 0.34 },
        { freq: 740, at: 0.07, gain: 0.15, duration: 0.42 },
      ],
    },
  },
  felt: {
    voice: feltButton,
    notes: {
      start: [
        { freq: 392, at: 0, gain: 0.2, duration: 0.2 },
        { freq: 523, at: 0.07, gain: 0.18, duration: 0.24 },
      ],
      pause: [
        { freq: 523, at: 0, gain: 0.18, duration: 0.2 },
        { freq: 349, at: 0.07, gain: 0.22, duration: 0.28 },
      ],
      reset: [{ freq: 466, at: 0, gain: 0.17, duration: 0.15 }],
      lock: [
        { freq: 440, at: 0, gain: 0.19, duration: 0.19 },
        { freq: 330, at: 0.07, gain: 0.21, duration: 0.26 },
      ],
      unlock: [
        { freq: 330, at: 0, gain: 0.2, duration: 0.19 },
        { freq: 440, at: 0.07, gain: 0.19, duration: 0.24 },
      ],
    },
  },
  string: {
    voice: stringButton,
    notes: {
      start: [
        { freq: 587, at: 0, gain: 0.15, duration: 0.32 },
        { freq: 784, at: 0.07, gain: 0.14, duration: 0.38 },
      ],
      pause: [
        { freq: 784, at: 0, gain: 0.14, duration: 0.3 },
        { freq: 523, at: 0.07, gain: 0.15, duration: 0.44 },
      ],
      reset: [{ freq: 698, at: 0, gain: 0.13, duration: 0.22 }],
      lock: [
        { freq: 659, at: 0, gain: 0.14, duration: 0.3 },
        { freq: 494, at: 0.07, gain: 0.15, duration: 0.4 },
      ],
      unlock: [
        { freq: 494, at: 0, gain: 0.15, duration: 0.3 },
        { freq: 659, at: 0.07, gain: 0.14, duration: 0.36 },
      ],
    },
  },
  drop: {
    voice: dropButton,
    notes: {
      start: [{ freq: 620, bendTo: 1080, at: 0, gain: 0.17, duration: 0.15 }],
      pause: [{ freq: 980, bendTo: 540, at: 0, gain: 0.17, duration: 0.17 }],
      reset: [{ freq: 820, bendTo: 760, at: 0, gain: 0.13, duration: 0.1 }],
      lock: [{ freq: 900, bendTo: 520, at: 0, gain: 0.16, duration: 0.16 }],
      unlock: [{ freq: 520, bendTo: 900, at: 0, gain: 0.16, duration: 0.15 }],
    },
  },
};

/**
 * Deliberately faint and brief. These fire on every button, so anything with
 * presence would compete with the transitions, which are the sounds that
 * actually carry information.
 *
 * There is no way to turn them off, and that is the point: feedback you cannot
 * hear is a button you are not sure you pressed. Muting is what the volume
 * control is for.
 */
export function press(kind: Press): void {
  silence();
  const kit = kits[buttons];
  for (const note of kit.notes[kind]) kit.voice(note);
}
