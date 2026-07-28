# Gloam

A floating, ambient focus timer that lives in the corner of your screen.

Gloam is not a window you switch to. It is a small always-on-top widget that
sits on a second monitor and runs configurable focus and break intervals while
you work. Its backdrop moves through dusk as the session elapses — the sun
descends toward the horizon during focus, the moon rises during a break — so a
glance tells you roughly how much time is left before you read a single digit.

Built with **Tauri 2**, **Svelte 5** and **TypeScript**. The release binary is
a few megabytes and idles at a fraction of the memory an Electron equivalent
would need, which matters for something meant to stay open all day.

---

## Why this exists

Existing Pomodoro apps fall into two camps. Some are full applications with
task lists, statistics and accounts — far more surface than a countdown needs.
Others are ambient "focus companion" experiences on Steam, which are lovely but
demand attention of their own: scenes to configure, characters to watch.

Gloam takes the middle path deliberately: the ambience is decorative and
peripheral, never interactive. There is nothing in it to fiddle with.

One small design decision that came out of using those other apps: **a break is
only ever placed between two focus sessions, never after the last one.** A
trailing break has nothing to resume into, so it is dead time.

## Features

- Frameless, transparent, always-on-top window you can drag anywhere
- Focus/break interval cycles with a plan that ends on a focus session
- An ambient sky whose state encodes progress
- Lock mode: dims the widget and lets clicks pass through to the window beneath
- Compact mode: double-click to shrink to the readout, play control and padlock
- Soft synthesised chimes at every transition — no audio assets, no jump scares
- Controls stay hidden until you hover, so the widget reads as scenery

### Keyboard

| Key | Action |
| --- | --- |
| `Space` | Start / pause |
| `S` | Skip to next segment |
| `R` | Reset the run |
| `L` | Toggle lock |
| `Ctrl+Alt+G` | Toggle lock, from anywhere |

## Lock mode

An always-on-top widget is easy to live with on a second monitor and awkward on
a single one, where it covers the document you are reading and intercepts
clicks meant for it. Clicking the padlock turns the whole window click-through,
so the mouse passes straight to whatever is underneath, and drops the widget to
44% opacity so it reads as a watermark.

The interesting part is getting back out. Click-through is a whole-window
property — no platform exposes "pass everything through except this button" —
so Gloam does the hit-testing itself. While locked it polls the global cursor
position every 70 ms and compares it against the padlock's rectangle in screen
coordinates. When the cursor enters, click-through is switched off so the click
can land; when it leaves, it goes back on. The padlock behaves like a hole in
an otherwise pass-through surface.

Two known consequences:

- While the cursor is inside the padlock's rectangle the entire window is
  briefly clickable again, so a click a few pixels outside the padlock is
  swallowed rather than passed through. The hotspot is kept small to limit it.
- Polling costs one IPC round trip every 70 ms, and only while locked.

`Ctrl+Alt+G` is registered in Rust as a safety net: if hit-testing ever fails
on an unusual window manager, the widget is still recoverable. If another
application already owns that shortcut, registration fails quietly and the
padlock keeps working.

## Compact mode

Double-clicking collapses the widget to a single row: the readout, the play
control and the padlock. Skip, reset and close are dropped rather than shrunk —
below about 24px a button stops being worth aiming at — and stay available on
the keyboard. Double-clicking again restores the full widget.

## Running it

Requires [Node.js](https://nodejs.org) 18+ and the
[Rust toolchain](https://rustup.rs). On Windows you also need the
**Desktop development with C++** workload from the Visual Studio Build Tools.

```bash
npm install
npm run app        # development build with hot reload
npm run app:build  # produce an installer in src-tauri/target/release/bundle
```

The frontend runs standalone in a browser too, which is convenient for
iterating on the visual layer without a Rust rebuild:

```bash
npm run dev        # then open http://localhost:1420
```

All Tauri calls are guarded, so the widget degrades gracefully outside the
desktop shell.

## Platform support

| | Status |
| --- | --- |
| Windows 10/11 | Fully supported |
| Linux (X11) | Fully supported |
| Linux (Wayland) | Runs, but always-on-top is ignored |

The Wayland limitation is [upstream](https://github.com/tauri-apps/tao/issues/1134):
the protocol gives clients no way to request that a surface stay above others.
The planned workaround is a `gtk-layer-shell` overlay surface — see the roadmap.

## Roadmap

Everything below is built on one rule: **the default state never gets busier.**
Settings and the music player arrive as panels you expand into, so a Gloam with
every feature enabled still looks like the Gloam in the screenshot until you ask
it for more. Growth goes into disclosure, not into the resting state.

- [x] **Phase 1** — Floating widget, fixed 30/10 cycles, ambient sky, chimes
- [x] **Phase 2** — Lock mode with cursor hit-testing, compact mode, persistence
- [ ] **Phase 3** — A scale factor and a corner resize handle, so later panels are
      built inside a container that already knows how to grow
- [ ] **Phase 4** — Settings panel: durations, session count, volume, alarm timbre
- [ ] **Phase 5** — Ambient life on the backdrop: slow drifting clouds, and a
      distant flock of birds as a rare event
- [ ] **Phase 6** — Scene editor: swap the horizon band for a city skyline whose
      windows light up as the sun goes down, or a mountain ridge
- [ ] **Phase 7** — System tray, launch on startup, session history
- [ ] **Phase 8** — `gtk-layer-shell` path so always-on-top works under Wayland

Phases 1–8 make a complete v1.0.

- [ ] **Phase 9** — Ambient music from a local folder: an expandable mini player
      showing the current track, elapsed time and transport controls, with tag
      reading and FLAC decoding in Rust. Deliberately last: it is the heaviest
      subsystem in the project and the only one nothing else depends on.

### A note on motion

The eye detects movement in peripheral vision far better than it detects detail
or colour — which is exactly the hazard for an app whose whole purpose is to not
take your attention. Ambient motion here is therefore governed by one rule:
**continuous motion must be too slow to trigger that reflex, and anything fast
must be rare.** Clouds drift slowly enough that you only notice they moved by
comparing two moments. Birds cross once every several minutes, which turns them
from noise into something you catch by chance and enjoy. Scarcity is what makes
them work.

## Project layout

```
src/
  App.svelte          composition and layout of every visual layer
  lib/
    timer.svelte.ts   the state machine and countdown
    lock.svelte.ts    click-through and cursor hit-testing
    sky.ts            the palette, keyframes and interpolation
    chime.ts          WebAudio alarm synthesis
    prefs.ts          persisted preferences
    window.ts         guarded wrappers over the Tauri window API
    Stars.svelte      fixed star field
    Grain.svelte      generated film grain
    Controls.svelte   transport buttons
    Padlock.svelte    the animated lock
src-tauri/            Rust shell, window configuration, global shortcut
```

## License

MIT — see [LICENSE](LICENSE).
