/**
 * Alarms, synthesised rather than shipped as audio files.
 *
 * Keeping these as oscillators means no binary assets in the repo, no decoding
 * latency, and the timbre stays tweakable in code. They are deliberately soft:
 * the point is to notice the transition, not to be startled out of your chair.
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

interface Note {
  /** Frequency in Hz. */
  freq: number;
  /** Seconds from the start of the chime. */
  at: number;
  /** Seconds. */
  length: number;
}

function play(notes: Note[], volume: number): void {
  if (volume <= 0) return;

  const ac = audio();
  const now = ac.currentTime + 0.02;

  const bus = ac.createGain();
  bus.gain.value = Math.min(1, Math.max(0, volume));
  bus.connect(ac.destination);

  for (const note of notes) {
    const start = now + note.at;
    const end = start + note.length;

    // A sine for the body plus a quiet triangle an octave up gives the tone a
    // little shimmer without making it harsh.
    for (const [type, mul, level] of [
      ["sine", 1, 1],
      ["triangle", 2, 0.16],
    ] as const) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = type;
      osc.frequency.value = note.freq * mul;

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level * 0.28, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain);
      gain.connect(bus);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }
}

export type ChimeKind = "focus-end" | "break-end" | "done";

/**
 * focus-end  descending pair, reads as "put it down"
 * break-end  ascending pair, reads as "pick it back up"
 * done       a small resolved chord
 */
export function chime(kind: ChimeKind, volume = 0.6): void {
  switch (kind) {
    case "focus-end":
      play(
        [
          { freq: 587.33, at: 0, length: 0.9 },
          { freq: 440.0, at: 0.16, length: 1.1 },
        ],
        volume
      );
      break;

    case "break-end":
      play(
        [
          { freq: 440.0, at: 0, length: 0.7 },
          { freq: 659.25, at: 0.14, length: 1.0 },
        ],
        volume
      );
      break;

    case "done":
      play(
        [
          { freq: 523.25, at: 0, length: 1.4 },
          { freq: 659.25, at: 0.12, length: 1.4 },
          { freq: 783.99, at: 0.24, length: 1.6 },
        ],
        volume
      );
      break;
  }
}
