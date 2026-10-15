/**
 * Every word Gloam says, in English.
 *
 * One object, nested by where the words appear, so that a translator can read
 * it top to bottom and see the interface rather than a list of keys. Its shape
 * is the contract every other language signs: `Messages` is derived from this
 * object, so a dictionary missing a line, carrying an extra one, or taking a
 * different argument where a sentence has a number in it does not compile.
 *
 * Anything with a number or a name inside it is a function rather than a
 * template with a placeholder. A placeholder can be misspelt, left out or
 * doubled and nothing notices until somebody reads the screen; a function's
 * arguments are checked like any other code, and each language can arrange
 * the sentence around the number however its grammar needs — plurals
 * included, which no single template survives.
 *
 * What stays in English everywhere is not here at all: the name Gloam, the
 * formats a folder may hold, and Ctrl+Alt+G, which is what the keys say.
 */
export const en = {
  /** The phase above the readout. Short, and shown in capitals. */
  phase: {
    focus: "FOCUS",
    break: "BREAK",
    done: "DONE",
  },

  /** The widget's own surface and the controls on its face. */
  widget: {
    background:
      "Widget background. Drag to move, double-click to toggle compact mode.",
    hide: "Hide",
    hideTitle: "Hide — Gloam keeps running in the tray",
    quit: "Quit",
    quitTitle: "Quit Gloam",
    openSettings: "Open settings",
    closeSettings: "Close settings",
    /** Follows the keys themselves, which are drawn separately. */
    toUnlock: "to unlock",
    /** The dots under the readout, for a screen reader. */
    sessionOf: (session: number, total: number) => `Session ${session} of ${total}`,
  },

  timer: {
    start: "Start",
    pause: "Pause",
    startTitle: "Start (Space)",
    pauseTitle: "Pause (Space)",
    skip: "Skip segment",
    reset: "Reset",
  },

  music: {
    previous: "Previous track",
    next: "Next track",
    play: "Play music",
    pause: "Pause music",
  },

  padlock: {
    lockTitle: "Lock and let clicks pass through (Ctrl+Alt+G)",
    unlockTitle: "Unlock (Ctrl+Alt+G)",
    lock: "Lock widget",
    unlock: "Unlock widget",
  },

  grip: {
    label: "Widget size",
    title: "Drag to resize · double-click to reset",
  },

  /** Read aloud by a screen reader beside the arrows of a control. */
  controls: {
    previousOf: (name: string) => `Previous ${name}`,
    nextOf: (name: string) => `Next ${name}`,
    decrease: (name: string) => `Decrease ${name}`,
    increase: (name: string) => `Increase ${name}`,
  },

  tour: {
    /** Three lines at the panel's width. Longer and nobody reads it. */
    steps: {
      sky:
        "Gloam keeps time in the corner of your screen. The sky is the clock — " +
        "the sun sinks while you focus, and the moon comes up while you rest.",
      handles:
        "There is no title bar: drag it from anywhere on its face. The corner " +
        "resizes it, and the arrow below opens the settings.",
      compact:
        "Too big? A double-click folds it into a single row — the clock, play " +
        "and the padlock. Try it: double-click again to bring it back.",
      away:
        "Still in the way? The padlock lets clicks pass right through, and " +
        "closing tucks Gloam into the tray with the run going. Ctrl+Alt+G " +
        "brings it back.",
    },
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    skip: "Skip",
    previous: "Previous",
    next: "Next",
    finish: "Finish",
  },

  panel: {
    tabs: {
      general: "General",
      ambience: "Ambience",
      music: "Music",
      keys: "Keys",
    },

    cycle: "Cycle",
    pauseToEdit: "pause to edit",
    changeRestarts: "changing restarts the run",
    focus: "Focus",
    break: "Break",
    sessions: "Sessions",
    /** Follows a number directly, so it carries its own leading space. */
    minutes: " min",

    startup: "Startup",
    launchAtLogin: "Launch at login",
    startsInTray: "Gloam waits in the tray. Ctrl+Alt+G brings it out.",
    startsOnScreen: "Gloam opens on screen: this desktop has no tray to wait in.",

    volume: "Volume",
    sound: "Sound",
    sounds: {
      bowl: "Bowl",
      bell: "Bell",
      felt: "Felt",
    },
    soundHints: {
      bowl: "The widget's own voice. Warm, and slow to fade.",
      bell: "Metal, announced in three notes. Hard to miss.",
      felt: "Wood and felt, fading into itself. Barely there.",
    },

    backdrop: "Backdrop",
    backdrops: {
      full: "Full",
      calm: "Calm",
      light: "Light",
    },
    backdropHints: {
      full: "Clouds and the occasional flock.",
      calm: "Clouds only. Nothing crosses quickly.",
      light: "A flat sky, for a modest machine.",
    },

    horizon: "Horizon",
    horizons: {
      water: "Water",
      skyline: "Skyline",
      ridge: "Ridge",
    },

    folder: "Folder",
    choose: "Choose…",
    noFolder: "Anything Gloam can decode. Read, never changed.",
    emptyFolder: "Nothing playable here, or the folder has moved.",
    tracks: (count: number) => (count === 1 ? "1 track" : `${count} tracks`),
    musicVolume: "Music volume",
    ducked: "Ducked while Gloam has something to say.",
    shuffle: "Shuffle",
    crossfade: "Crossfade",

    tourAgain: "Show the tour again",
  },

  /** The Keys tab, one row per shortcut. */
  shortcuts: {
    toggleTimer: { keys: "Space", does: "Start or pause" },
    toggleCompact: { keys: "C", does: "Fold to compact" },
    togglePanel: { keys: "S", does: "Open settings" },
    scale: { keys: "+ / −", does: "Resize" },
    lock: { keys: "Ctrl+Alt+G", does: "Lock, from anywhere" },
  },

  /** The tray icon's menu, which Rust builds and the frontend names. */
  tray: {
    show: "Show Gloam",
    hide: "Hide Gloam",
    recover: "Reset position",
    quit: "Quit",
  },
};

/**
 * The shape every dictionary has to have.
 *
 * Derived rather than written out, so the English is the only place the
 * structure is declared: add a line here and every other language stops
 * compiling until it has one too.
 */
export type Messages = typeof en;
